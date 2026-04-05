import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const HOST = process.env.HOST || '0.0.0.0'
const PORT = Number(process.env.PORT || 4321)
const SEED_DATA_DIR = path.join(__dirname, 'data')
const DATA_DIR = fs.existsSync('/data') ? '/data' : SEED_DATA_DIR
const CATALOG_PATH = path.join(SEED_DATA_DIR, 'wine-catalog.json')
const DEFAULT_RECORDS_PATH = path.join(SEED_DATA_DIR, 'default-cellar-records.json')
const RECORDS_PATH = path.join(DATA_DIR, 'cellar-records.json')
const EXTERNAL_CACHE_PATH = path.join(DATA_DIR, 'external-catalog-cache.json')
const DEFAULT_LABELS_PATH = path.join(SEED_DATA_DIR, 'default-wine-labels.json')
const LABELS_PATH = path.join(DATA_DIR, 'wine-labels.json')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

const EMPTY_EXTRACTION = {
  producer: null,
  wineName: null,
  vintage: null,
  region: null,
  country: null,
  grapeVariety: null,
  confidence: 0,
  visibleText: [],
  notes: null,
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(body)
}

function parseEnvFile(fileName) {
  const filePath = path.join(__dirname, fileName)
  if (!fs.existsSync(filePath)) return {}

  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .reduce((acc, line) => {
      const [key, ...rest] = line.split('=')
      acc[key.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '')
      return acc
    }, {})
}

const localEnv = {
  ...parseEnvFile('.env'),
  ...parseEnvFile('.env.local'),
}

const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || localEnv.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || localEnv.OPENAI_API_KEY || ''
const OPENAI_MODEL = process.env.OPENAI_MODEL || localEnv.OPENAI_MODEL || 'gpt-4.1-mini'
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY || localEnv.GOOGLE_SEARCH_API_KEY || ''
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX || localEnv.GOOGLE_SEARCH_CX || ''
const GOOGLE_SEARCH_ENDPOINT = 'https://www.googleapis.com/customsearch/v1'

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback
    throw error
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

async function ensureRuntimeDataFiles() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true })

  if (!fs.existsSync(RECORDS_PATH)) {
    const defaultRecords = await readJson(DEFAULT_RECORDS_PATH, [])
    await writeJson(RECORDS_PATH, defaultRecords)
  }

  if (!fs.existsSync(LABELS_PATH)) {
    await writeJson(LABELS_PATH, {})
  }
}

async function readRequestBody(req) {
  const chunks = []

  for await (const chunk of req) {
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}

  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('Request body must be valid JSON.')
  }
}

function normalize(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(value) {
  return normalize(value).replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function uniqueTokens(values) {
  const tokens = new Set()
  for (const value of values) {
    for (const token of normalize(value).split(' ')) {
      if (token && token.length > 1) tokens.add(token)
    }
  }
  return [...tokens]
}

function tokenOverlap(sourceValues, targetValues) {
  const left = uniqueTokens(sourceValues)
  const rightSet = new Set(uniqueTokens(targetValues))
  if (!left.length || !rightSet.size) return 0
  let matches = 0
  for (const token of left) {
    if (rightSet.has(token)) matches += 1
  }
  return matches / Math.max(left.length, rightSet.size)
}

function includesPrefixMatch(sourceValue, targetValues) {
  const source = normalize(sourceValue)
  if (!source) return false

  return targetValues.some((value) => {
    const target = normalize(value)
    return target && (target.startsWith(source) || source.startsWith(target) || target.includes(source))
  })
}

function exactMatch(sourceValue, targetValues) {
  const source = normalize(sourceValue)
  if (!source) return false

  return targetValues.some((value) => normalize(value) === source)
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number))
}

function sanitizeLabelImageSource(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
    if (trimmed.length > 2_500_000) return null
    return trimmed
  }
  if (/^\/assets\/[a-z0-9/_-]+\.(png|jpe?g|webp|svg)$/i.test(trimmed)) {
    return trimmed
  }
  return null
}

function getStoredLabelImage(labelEntry) {
  if (!labelEntry || typeof labelEntry !== 'object') return null
  return sanitizeLabelImageSource(labelEntry.imagePath || labelEntry.imageDataUrl)
}

function getRecordLabelImage(record, labels) {
  return getStoredLabelImage(labels?.[record.wineId]) || sanitizeLabelImageSource(record.labelImageDataUrl)
}

function hasStoredLabelImage(wineId, labels) {
  return Boolean(getStoredLabelImage(labels?.[wineId]))
}

function mergeLabelSources(defaultLabels, customLabels) {
  return {
    ...(customLabels || {}),
    ...(defaultLabels || {}),
  }
}

function sanitizeLabelImageDataUrl(value) {
  const sanitized = sanitizeLabelImageSource(value)
  if (!sanitized || !sanitized.startsWith('data:image/')) return null
  return sanitized
}

function parseVintage(value) {
  if (value === null || value === undefined || value === '') return null
  const match = String(value).match(/\b(19|20)\d{2}\b/)
  return match ? Number(match[0]) : null
}

function extractJsonFromText(text) {
  const trimmed = String(text || '').trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model response did not include a JSON object.')
  }
  return JSON.parse(trimmed.slice(start, end + 1))
}

function sanitizeExtraction(payload) {
  return {
    producer: payload.producer ? String(payload.producer).trim() : null,
    wineName: payload.wineName ? String(payload.wineName).trim() : null,
    vintage: parseVintage(payload.vintage),
    region: payload.region ? String(payload.region).trim() : null,
    country: payload.country ? String(payload.country).trim() : null,
    grapeVariety: payload.grapeVariety ? String(payload.grapeVariety).trim() : null,
    confidence: clamp(Number(payload.confidence || 0), 0, 1),
    visibleText: Array.isArray(payload.visibleText)
      ? payload.visibleText.map((value) => String(value).trim()).filter(Boolean).slice(0, 12)
      : [],
    notes: payload.notes ? String(payload.notes).trim() : null,
  }
}

function buildExternalQuery(extraction) {
  return [
    extraction.producer,
    extraction.wineName,
    extraction.grapeVariety,
    extraction.vintage,
    extraction.region,
    extraction.country,
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function combineSearchText(...values) {
  return values.filter(Boolean).join(' ').trim()
}

function normalizeExternalCandidate(candidate) {
  return {
    id: String(candidate.id || '').trim(),
    producer: candidate.producer ? String(candidate.producer).trim() : null,
    wineName: candidate.wineName ? String(candidate.wineName).trim() : null,
    vintage: parseVintage(candidate.vintage),
    region: candidate.region ? String(candidate.region).trim() : null,
    country: candidate.country ? String(candidate.country).trim() : null,
    grapeVariety: candidate.grapeVariety ? String(candidate.grapeVariety).trim() : null,
    aliases: Array.isArray(candidate.aliases) ? candidate.aliases.map((value) => String(value).trim()).filter(Boolean).slice(0, 8) : [],
    externalUrl: candidate.externalUrl ? String(candidate.externalUrl).trim() : null,
    externalHost: candidate.externalHost ? String(candidate.externalHost).trim() : null,
    sourceType: candidate.sourceType ? String(candidate.sourceType).trim() : 'external-search',
  }
}

async function persistExternalCandidates(candidates) {
  if (!candidates.length) return
  const existing = await readJson(EXTERNAL_CACHE_PATH, [])
  const nextById = new Map(existing.map((item) => [item.id, normalizeExternalCandidate(item)]))
  for (const candidate of candidates) {
    nextById.set(candidate.id, normalizeExternalCandidate(candidate))
  }
  await writeJson(EXTERNAL_CACHE_PATH, [...nextById.values()])
}

function computeExternalEvidenceScore(extraction, item) {
  const extractionText = combineSearchText(
    extraction.producer,
    extraction.wineName,
    extraction.grapeVariety,
    extraction.vintage,
    extraction.region,
    extraction.country,
    ...(extraction.visibleText || [])
  )
  const resultText = combineSearchText(item.title, item.snippet)
  return tokenOverlap([extractionText], [resultText])
}

function buildExternalCandidateFromSearchResult(extraction, item, index) {
  const url = new URL(item.link)
  const host = url.hostname.replace(/^www\./, '')
  const evidenceScore = computeExternalEvidenceScore(extraction, item)
  const title = String(item.title || '').trim()
  const querySignature = slugify(buildExternalQuery(extraction)) || `result-${index + 1}`
  return {
    id: `external-${querySignature}-${slugify(host)}-${index + 1}`,
    producer: extraction.producer,
    wineName: extraction.wineName || title || 'Unknown Wine',
    vintage: extraction.vintage,
    region: extraction.region,
    country: extraction.country,
    grapeVariety: extraction.grapeVariety,
    aliases: [title].filter(Boolean),
    externalUrl: item.link,
    externalHost: host,
    sourceType: 'external-search',
    ...deriveSweetnessProfile({
      wineName: extraction.wineName,
      grapeVariety: extraction.grapeVariety,
      region: extraction.region,
    }),
    hasProducerExact: exactMatch(extraction.producer, [extraction.producer]),
    hasProducerPrefix: true,
    producerScore: extraction.producer ? 1 : 0,
    varietyScore: extraction.grapeVariety ? 1 : 0,
    countryScore: extraction.country ? 1 : 0,
    regionScore: extraction.region ? 1 : 0,
    matchSignals: 3,
    matchScore: Math.round((44 + evidenceScore * 46) * 10) / 10,
    matchReasons: [
      `web search hit on ${host}`,
      title ? `title: ${title}` : null,
      item.snippet ? `snippet corroboration ${Math.round(evidenceScore * 100)}%` : null,
    ].filter(Boolean),
  }
}

function buildExtractionFallbackCandidate(extraction) {
  const querySignature = slugify(buildExternalQuery(extraction)) || `ocr-${Date.now()}`
  const confidence = clamp(Number(extraction.confidence || 0), 0, 1)
  return {
    id: `ocr-derived-${querySignature}`,
    producer: extraction.producer || 'Unknown Producer',
    wineName: extraction.wineName || extraction.grapeVariety || 'Uncatalogued Wine',
    vintage: extraction.vintage,
    region: extraction.region,
    country: extraction.country,
    grapeVariety: extraction.grapeVariety,
    aliases: extraction.visibleText || [],
    externalUrl: null,
    externalHost: null,
    sourceType: 'ocr-derived',
    ...deriveSweetnessProfile({
      wineName: extraction.wineName,
      grapeVariety: extraction.grapeVariety,
      region: extraction.region,
    }),
    hasProducerExact: Boolean(extraction.producer),
    hasProducerPrefix: Boolean(extraction.producer),
    producerScore: extraction.producer ? 1 : 0,
    varietyScore: extraction.grapeVariety ? 1 : 0,
    countryScore: extraction.country ? 1 : 0,
    regionScore: extraction.region ? 1 : 0,
    matchSignals: 2,
    matchScore: Math.round((38 + confidence * 42) * 10) / 10,
    matchReasons: [
      'derived directly from OCR extraction',
      extraction.visibleText?.length ? `visible text: ${extraction.visibleText.slice(0, 4).join(' / ')}` : null,
      extraction.notes || null,
    ].filter(Boolean),
  }
}

async function searchExternalWineCandidates(extraction) {
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) return []
  const query = buildExternalQuery(extraction)
  if (!query || query.split(/\s+/).length < 2) return []

  const url = new URL(GOOGLE_SEARCH_ENDPOINT)
  url.searchParams.set('key', GOOGLE_SEARCH_API_KEY)
  url.searchParams.set('cx', GOOGLE_SEARCH_CX)
  url.searchParams.set('q', query)
  url.searchParams.set('num', '5')

  const response = await fetch(url)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`External wine search failed: ${response.status} ${detail.slice(0, 240)}`)
  }

  const payload = await response.json()
  const items = Array.isArray(payload.items) ? payload.items : []
  return items
    .filter((item) => item.link && (item.title || item.snippet))
    .map((item, index) => buildExternalCandidateFromSearchResult(extraction, item, index))
    .filter((candidate) => candidate.matchScore >= 48)
    .slice(0, 5)
}

async function callOpenAIVision(imageDataUrl) {
  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text:
                'You are extracting wine label metadata from a single bottle photo. ' +
                'Read visible label text, infer the most likely wine identity, and fill the requested fields. ' +
                'If the image is not a wine label, return null fields and explain briefly in notes.',
            },
            {
              type: 'input_image',
              image_url: imageDataUrl,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'wine_label_extraction',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              producer: { type: ['string', 'null'] },
              wineName: { type: ['string', 'null'] },
              vintage: { type: ['integer', 'null'] },
              region: { type: ['string', 'null'] },
              country: { type: ['string', 'null'] },
              grapeVariety: { type: ['string', 'null'] },
              confidence: { type: 'number' },
              visibleText: {
                type: 'array',
                items: { type: 'string' },
              },
              notes: { type: ['string', 'null'] },
            },
            required: [
              'producer',
              'wineName',
              'vintage',
              'region',
              'country',
              'grapeVariety',
              'confidence',
              'visibleText',
              'notes',
            ],
          },
        },
      },
      max_output_tokens: 400,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`OpenAI vision request failed: ${response.status} ${detail.slice(0, 300)}`)
  }

  const payload = await response.json()
  const text = payload.output_text || payload.output?.[0]?.content?.[0]?.text || ''
  return sanitizeExtraction(extractJsonFromText(text))
}

function deriveSweetnessProfile(wine) {
  const styleSource = `${wine.wineName || ''} ${wine.grapeVariety || ''} ${wine.region || ''}`.toLowerCase()

  if (styleSource.includes('sauternes') || styleSource.includes('yquem')) {
    return { sweetness: 92, sweetnessLabel: 'Sweet Rich' }
  }
  if (styleSource.includes('sauvignon blanc')) {
    return { sweetness: 18, sweetnessLabel: 'Dry Crisp' }
  }
  if (styleSource.includes('chablis')) {
    return { sweetness: 16, sweetnessLabel: 'Dry Mineral' }
  }
  if (styleSource.includes('chardonnay')) {
    return { sweetness: 28, sweetnessLabel: 'Dry Round' }
  }
  if (styleSource.includes('champagne') || styleSource.includes('brut') || styleSource.includes('dom perignon') || styleSource.includes('veuve clicquot')) {
    return { sweetness: 20, sweetnessLabel: 'Dry Sparkling' }
  }
  if (styleSource.includes('merlot')) {
    return { sweetness: 26, sweetnessLabel: 'Soft Dry' }
  }
  if (styleSource.includes('malbec')) {
    return { sweetness: 22, sweetnessLabel: 'Dry Plush' }
  }
  if (styleSource.includes('tempranillo') || styleSource.includes('rioja')) {
    return { sweetness: 24, sweetnessLabel: 'Savory Dry' }
  }
  if (styleSource.includes('sangiovese') || styleSource.includes('tignanello')) {
    return { sweetness: 18, sweetnessLabel: 'Dry Structured' }
  }
  if (styleSource.includes('cabernet') || styleSource.includes('bordeaux') || styleSource.includes('blend') || styleSource.includes('sassicaia') || styleSource.includes('ornellaia') || styleSource.includes('insignia') || styleSource.includes('opus one')) {
    return { sweetness: 14, sweetnessLabel: 'Dry Bold' }
  }

  return { sweetness: 30, sweetnessLabel: 'Balanced Dry' }
}

function labelSweetnessFromValue(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 'Balanced'
  if (numeric <= 20) return 'Very Dry'
  if (numeric <= 40) return 'Dry'
  if (numeric <= 60) return 'Balanced'
  if (numeric <= 80) return 'Sweet'
  return 'Very Sweet'
}

function mockExtractionFromFilename(fileName, catalog) {
  const normalizedName = normalize(fileName)
  const directMatch = catalog.find((wine) =>
    [wine.producer, wine.wineName, ...(wine.aliases || [])].some((value) => normalizedName.includes(normalize(value)))
  )

  if (directMatch) {
    return {
      producer: directMatch.producer,
      wineName: directMatch.wineName,
      vintage: directMatch.vintage,
      region: directMatch.region,
      country: directMatch.country,
      grapeVariety: directMatch.grapeVariety,
      confidence: 0.62,
      visibleText: [directMatch.producer, directMatch.wineName, String(directMatch.vintage || '')].filter(Boolean),
      notes: 'Simulation mode guessed the wine from the uploaded filename.',
    }
  }

  const vintage = parseVintage(fileName)
  const words = normalize(fileName).split(' ').filter(Boolean)
  const producer = words.slice(0, 2).join(' ') || null
  const wineName = words.slice(2, 5).join(' ') || null

  return {
    ...EMPTY_EXTRACTION,
    producer,
    wineName,
    vintage,
    confidence: 0.28,
    visibleText: words.slice(0, 6),
    notes: 'Simulation mode could not call vision OCR, so it guessed from the filename only.',
  }
}

function buildSearchCandidates(catalog, extraction) {
  const producerInput = extraction.producer
  const varietyInput = extraction.grapeVariety || extraction.wineName
  const regionInput = extraction.region
  const countryInput = extraction.country

  const candidates = catalog.map((wine) => {
    const reasons = []
    let score = 0
    let matchSignals = 0
    const producerValues = [wine.producer, ...(wine.aliases || [])]

    const hasProducerExact = exactMatch(producerInput, producerValues)
    const hasProducerPrefix = includesPrefixMatch(producerInput, producerValues)
    const producerScore = tokenOverlap([producerInput], producerValues)
    if (hasProducerExact) {
      score += 90
      matchSignals += 3
      reasons.push('producer exact match')
    } else if (hasProducerPrefix) {
      score += 62
      matchSignals += 2
      reasons.push('producer prefix match')
    } else if (producerScore >= 0.45) {
      score += producerScore * 42
      matchSignals += 1
      reasons.push(`producer ${Math.round(producerScore * 100)}% match`)
    }

    const wineNameScore = tokenOverlap(
      [extraction.wineName, ...(extraction.visibleText || [])],
      [wine.wineName, ...(wine.aliases || []), wine.region, wine.grapeVariety]
    )
    if (wineNameScore >= 0.24) {
      score += wineNameScore * 34
      matchSignals += 1
      reasons.push(`label ${Math.round(wineNameScore * 100)}% match`)
    }

    const varietyScore = tokenOverlap([varietyInput], [wine.grapeVariety, wine.wineName, ...(wine.aliases || [])])
    if (varietyScore >= 0.34) {
      score += varietyScore * 28
      matchSignals += 1
      reasons.push(`variety ${Math.round(varietyScore * 100)}% match`)
    }

    const countryScore = tokenOverlap([countryInput], [wine.country])
    if (countryScore > 0) {
      score += countryScore * 20
      matchSignals += 1
      reasons.push(`country ${wine.country}`)
    }

    const regionScore = tokenOverlap([regionInput], [wine.region])
    if (regionScore > 0) {
      score += regionScore * 16
      matchSignals += 1
      reasons.push(`region ${wine.region}`)
    }

    if (extraction.vintage && wine.vintage && extraction.vintage === wine.vintage) {
      score += 18
      reasons.push(`vintage ${wine.vintage}`)
    } else if (extraction.vintage && !wine.vintage) {
      score += 4
      reasons.push('non-vintage candidate')
    }

    const textScore = tokenOverlap(extraction.visibleText || [], [wine.producer, wine.wineName, wine.region, wine.country])
    if (textScore >= 0.2) {
      score += textScore * 10
    }

    return {
      ...wine,
      ...deriveSweetnessProfile(wine),
      hasProducerExact,
      hasProducerPrefix,
      producerScore,
      varietyScore,
      countryScore,
      regionScore,
      matchSignals,
      matchScore: Math.round(score * 10) / 10,
      matchReasons: reasons,
    }
  })

  const producerStrictMatches = candidates.filter((candidate) => candidate.hasProducerExact || candidate.hasProducerPrefix)
  if (producerInput && producerStrictMatches.length) {
    return producerStrictMatches
      .filter((candidate) => candidate.matchScore >= 40)
      .sort((left, right) => right.matchScore - left.matchScore || String(left.producer).localeCompare(String(right.producer)))
      .slice(0, 5)
  }

  const originVarietyMatches = candidates.filter((candidate) => {
    const hasVariety = candidate.varietyScore >= 0.34
    const hasCountry = candidate.countryScore > 0
    const hasRegion = candidate.regionScore > 0
    return hasVariety && (hasCountry || hasRegion)
  })

  if (originVarietyMatches.length) {
    return originVarietyMatches
      .filter((candidate) => candidate.matchScore >= 24 && candidate.matchSignals >= 2)
      .sort((left, right) => right.matchScore - left.matchScore || String(left.producer).localeCompare(String(right.producer)))
      .slice(0, 5)
  }

  return candidates
    .filter((candidate) => candidate.matchScore >= 34 && candidate.matchSignals >= 2)
    .sort((left, right) => right.matchScore - left.matchScore || String(left.producer).localeCompare(String(right.producer)))
    .slice(0, 5)
}

function isValidRating(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 5 && Math.round(numeric * 2) === numeric * 2
}

async function handleScan(body) {
  const catalog = await readJson(CATALOG_PATH, [])
  const imageDataUrl = body.imageDataUrl
  const fileName = body.fileName ? String(body.fileName) : 'unknown-image'

  if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    throw new Error('imageDataUrl must be a valid data URL created from an uploaded image.')
  }

  const extraction = OPENAI_API_KEY
    ? await callOpenAIVision(imageDataUrl)
    : mockExtractionFromFilename(fileName, catalog)

  const localCandidates = buildSearchCandidates(catalog, extraction)
  let externalCandidates = []
  if (!localCandidates.length) {
    try {
      externalCandidates = await searchExternalWineCandidates(extraction)
    } catch (error) {
      extraction.notes = [extraction.notes, error instanceof Error ? error.message : 'External wine search failed.']
        .filter(Boolean)
        .join(' ')
    }
  }

  const fallbackCandidates = !localCandidates.length && !externalCandidates.length && (extraction.producer || extraction.wineName)
    ? [buildExtractionFallbackCandidate(extraction)]
    : []
  const candidates = localCandidates.length ? localCandidates : [...externalCandidates, ...fallbackCandidates]
  await persistExternalCandidates(candidates.filter((candidate) => candidate.sourceType && candidate.sourceType !== 'local'))
  return {
    mode: OPENAI_API_KEY ? 'live' : 'simulation',
    extraction,
    candidates,
  }
}

async function handleCreateRecord(body) {
  const catalog = await readJson(CATALOG_PATH, [])
  const externalCatalog = await readJson(EXTERNAL_CACHE_PATH, [])
  const records = await readJson(RECORDS_PATH, [])
  const defaultLabels = await readJson(DEFAULT_LABELS_PATH, {})
  const labels = await readJson(LABELS_PATH, {})
  const effectiveLabels = mergeLabelSources(defaultLabels, labels)
  const wineId = String(body.wineId || '').trim()
  const comment = String(body.comment || '').trim()
  const rating = Number(body.rating)
  const drinkAgain = body.drinkAgain
  const sweetness = Number(body.sweetness)
  const abv = body.abv === null || body.abv === undefined || body.abv === ''
    ? null
    : Number(body.abv)
  const labelImageDataUrl = sanitizeLabelImageDataUrl(body.labelImageDataUrl)

  if (!wineId) {
    throw new Error('wineId is required.')
  }
  if (!isValidRating(rating)) {
    throw new Error('rating must be between 0 and 5 in 0.5 increments.')
  }
  if (comment.length > 280) {
    throw new Error('comment must be 280 characters or fewer.')
  }
  if (typeof drinkAgain !== 'boolean') {
    throw new Error('drinkAgain must be true or false.')
  }
  if (!Number.isFinite(sweetness) || sweetness < 0 || sweetness > 100) {
    throw new Error('sweetness must be between 0 and 100.')
  }
  if (abv !== null && (!Number.isFinite(abv) || abv < 0 || abv > 30)) {
    throw new Error('abv must be between 0 and 30.')
  }

  const wine = [...catalog, ...externalCatalog].find((entry) => entry.id === wineId)
  if (!wine) {
    throw new Error('Selected wine was not found in the catalog.')
  }

  const record = {
    id: `record_${Date.now()}_${randomUUID().slice(0, 8)}`,
    wineId: wine.id,
    producer: wine.producer,
    wineName: wine.wineName,
    vintage: wine.vintage,
    region: wine.region,
    country: wine.country,
    grapeVariety: wine.grapeVariety,
    sweetness,
    sweetnessLabel: labelSweetnessFromValue(sweetness),
    abv,
    rating,
    comment,
    drinkAgain,
    decisionLabel: drinkAgain ? '또 먹을 와인' : '다시 안 먹을 와인',
    createdAt: new Date().toISOString(),
    imageName: body.imageName ? String(body.imageName).slice(0, 120) : null,
    extractionMode: body.extractionMode ? String(body.extractionMode).slice(0, 24) : null,
  }

  records.unshift(record)
  if (labelImageDataUrl && !hasStoredLabelImage(wine.id, effectiveLabels)) {
    labels[wine.id] = {
      imageDataUrl: labelImageDataUrl,
      updatedAt: new Date().toISOString(),
    }
    await writeJson(LABELS_PATH, labels)
  }
  await writeJson(RECORDS_PATH, records)
  return record
}

async function handleUpdateRecord(recordId, body) {
  const records = await readJson(RECORDS_PATH, [])
  const comment = String(body.comment || '').trim()

  if (comment.length > 280) {
    throw new Error('comment must be 280 characters or fewer.')
  }

  const recordIndex = records.findIndex((record) => record.id === recordId)
  if (recordIndex === -1) {
    throw new Error('Record not found.')
  }

  const updatedRecord = {
    ...records[recordIndex],
    comment,
    updatedAt: new Date().toISOString(),
  }
  records[recordIndex] = updatedRecord
  await writeJson(RECORDS_PATH, records)
  return updatedRecord
}

function serveStaticFile(req, res) {
  const requestUrl = new URL(req.url || '/', 'http://localhost')
  const requestPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname
  const safePath = path
    .normalize(decodeURIComponent(requestPath))
    .replace(/^[/\\]+/, '')
    .replace(/^(\.\.[/\\])+/, '')
  const filePath = path.join(__dirname, safePath)

  if (!filePath.startsWith(__dirname)) {
    sendText(res, 403, 'Forbidden')
    return
  }

  readFile(filePath)
    .then((content) => {
      const extension = path.extname(filePath).toLowerCase()
      res.writeHead(200, { 'Content-Type': MIME_TYPES[extension] || 'application/octet-stream' })
      res.end(content)
    })
    .catch(() => {
      sendText(res, 404, 'Not found')
    })
}

const server = createServer(async (req, res) => {
  try {
    if (!req.url) {
      sendText(res, 400, 'Missing URL')
      return
    }

    if (req.method === 'GET' && req.url === '/api/meta') {
      const records = await readJson(RECORDS_PATH, [])
      sendJson(res, 200, {
        appName: 'Wine Cellar Scan',
        hasApiKey: Boolean(OPENAI_API_KEY),
        mode: OPENAI_API_KEY ? 'live' : 'simulation',
        model: OPENAI_MODEL,
        baseUrl: OPENAI_BASE_URL,
        recordCount: records.length,
      })
      return
    }

    if (req.method === 'POST' && req.url === '/api/scan') {
      const body = await readRequestBody(req)
      const result = await handleScan(body)
      sendJson(res, 200, result)
      return
    }

    if (req.method === 'GET' && req.url === '/api/records') {
      const records = await readJson(RECORDS_PATH, [])
      const defaultLabels = await readJson(DEFAULT_LABELS_PATH, {})
      const labels = await readJson(LABELS_PATH, {})
      const effectiveLabels = mergeLabelSources(defaultLabels, labels)
      sendJson(res, 200, {
        records: records.map((record) => ({
          ...record,
          labelImageDataUrl: getRecordLabelImage(record, effectiveLabels),
        })),
      })
      return
    }

    if (req.method === 'POST' && req.url === '/api/records') {
      const body = await readRequestBody(req)
      const record = await handleCreateRecord(body)
      sendJson(res, 201, { record })
      return
    }

    if (req.method === 'PATCH' && req.url.startsWith('/api/records/')) {
      const recordId = decodeURIComponent(req.url.split('/').pop() || '')
      const body = await readRequestBody(req)
      const record = await handleUpdateRecord(recordId, body)
      sendJson(res, 200, { record })
      return
    }

    if (req.method === 'DELETE' && req.url.startsWith('/api/records/')) {
      const recordId = decodeURIComponent(req.url.split('/').pop() || '')
      const records = await readJson(RECORDS_PATH, [])
      const nextRecords = records.filter((record) => record.id !== recordId)
      if (nextRecords.length === records.length) {
        sendJson(res, 404, { error: 'Record not found.' })
        return
      }
      await writeJson(RECORDS_PATH, nextRecords)
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'GET') {
      serveStaticFile(req, res)
      return
    }

    sendText(res, 404, 'Not found')
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : 'Unexpected error',
    })
  }
})

async function startServer() {
  await ensureRuntimeDataFiles()
  server.listen(PORT, HOST, () => {
    console.log(`Wine Cellar Scan listening on http://${HOST}:${PORT}`)
    console.log(`Vision mode: ${OPENAI_API_KEY ? `live (${OPENAI_MODEL})` : 'simulation'}`)
    console.log(`Data directory: ${DATA_DIR}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
