const state = {
  meta: null,
  fileName: '',
  imageDataUrl: '',
  extractionMode: null,
  extraction: null,
  candidates: [],
  selectedWineId: null,
  rating: 0,
  sweetness: 50,
  saveDecision: 'again',
  recordFilter: 'again',
  searchQuery: '',
  recordSort: 'alpha',
  recordPage: 1,
  pageSize: 5,
  records: [],
  editingRecordId: null,
  editingComment: '',
}

const refs = {
  imageInput: document.querySelector('#image-input'),
  previewImage: document.querySelector('#preview-image'),
  previewEmpty: document.querySelector('#preview-empty'),
  scanButton: document.querySelector('#scan-button'),
  scanStatus: document.querySelector('#scan-status'),
  scanStatusLabel: document.querySelector('#scan-status-label'),
  extractionBox: document.querySelector('#extraction-box'),
  extractionFields: document.querySelector('#extraction-fields'),
  candidateEmpty: document.querySelector('#candidate-empty'),
  candidateList: document.querySelector('#candidate-list'),
  saveForm: document.querySelector('#save-form'),
  selectedSummary: document.querySelector('#selected-summary'),
  sweetnessInput: document.querySelector('#sweetness-input'),
  sweetnessReadout: document.querySelector('#sweetness-readout'),
  abvInput: document.querySelector('#abv-input'),
  commentInput: document.querySelector('#comment-input'),
  ratingGrid: document.querySelector('#rating-grid'),
  ratingReadout: document.querySelector('#rating-readout'),
  decisionAgainButton: document.querySelector('#decision-again-button'),
  decisionPassButton: document.querySelector('#decision-pass-button'),
  saveButton: document.querySelector('#save-button'),
  filterAgainButton: document.querySelector('#filter-again-button'),
  filterPassButton: document.querySelector('#filter-pass-button'),
  recordSearch: document.querySelector('#record-search'),
  recordSort: document.querySelector('#record-sort'),
  recordCount: document.querySelector('#record-count'),
  recordEmpty: document.querySelector('#record-empty'),
  recordList: document.querySelector('#record-list'),
  recordPagination: document.querySelector('#record-pagination'),
  tasteSummary: document.querySelector('#taste-summary'),
  tasteEmpty: document.querySelector('#taste-empty'),
  tasteMap: document.querySelector('#taste-map'),
  tasteGrid: document.querySelector('#taste-grid'),
  countrySummary: document.querySelector('#country-summary'),
  countryEmpty: document.querySelector('#country-empty'),
  countryBars: document.querySelector('#country-bars'),
}

const ratingOptions = Array.from({ length: 10 }, (_, index) => (index + 1) * 0.5)

function formatStarIcons(value) {
  const stars = []
  for (let index = 1; index <= 5; index += 1) {
    if (value >= index) stars.push('star')
    else if (value >= index - 0.5) stars.push('star_half')
    else stars.push('star')
  }
  return stars
}

function formatStarsText(value) {
  const full = Math.floor(value)
  const half = value % 1 === 0.5
  return `${'★'.repeat(full)}${half ? '⯨' : ''}${'☆'.repeat(5 - full - (half ? 1 : 0))}`
}

function setStatus(message, tone = 'neutral') {
  refs.scanStatusLabel.textContent = message
  refs.scanStatus.dataset.tone = tone
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number))
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sanitizeLabelImageUrl(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(trimmed)) return trimmed
  if (/^\/assets\/[a-z0-9/_-]+\.(png|jpe?g|webp|svg)$/i.test(trimmed)) return trimmed
  return ''
}

function getSweetnessLabel(value) {
  if (value <= 20) return 'Very Dry'
  if (value <= 40) return 'Dry'
  if (value <= 60) return 'Balanced'
  if (value <= 80) return 'Sweet'
  return 'Very Sweet'
}

function formatCalendarDate(value) {
  if (!value) return '날짜 미상'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || '날짜 미상'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(date)
}

function getCellarYears(vintage) {
  const numeric = Number(vintage)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const now = new Date()
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(now))
  if (!Number.isFinite(year) || year <= numeric) return null
  return year - numeric
}

function formatDrinkDatesLabel(dateKeys) {
  if (!dateKeys.length) return '먹은 날짜 없음'
  const formatted = dateKeys.slice(0, 3).map((dateKey) => formatCalendarDate(dateKey))
  return dateKeys.length > 3
    ? `${formatted.join(' · ')} · +${dateKeys.length - 3}`
    : formatted.join(' · ')
}

function getDateKey(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value || '0000'
  const month = parts.find((part) => part.type === 'month')?.value || '00'
  const day = parts.find((part) => part.type === 'day')?.value || '00'
  return `${year}-${month}-${day}`
}

function getTimestamp(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function compareAlphabetical(left, right) {
  return String(left.producer || '').localeCompare(String(right.producer || ''), 'en', { sensitivity: 'base' })
    || String(left.wineName || '').localeCompare(String(right.wineName || ''), 'en', { sensitivity: 'base' })
    || String(left.country || '').localeCompare(String(right.country || ''), 'en', { sensitivity: 'base' })
    || Number(right.vintage || 0) - Number(left.vintage || 0)
}

function getPreparedRecords() {
  const filteredByDecision = state.records.filter((record) => (state.recordFilter === 'again' ? record.drinkAgain : !record.drinkAgain))
  const groups = new Map()

  for (const record of filteredByDecision) {
    const key = record.wineId || `${record.producer}-${record.wineName}-${record.vintage || 'nv'}`
    const existing = groups.get(key) || {
      wineId: key,
      records: [],
      dateMap: new Map(),
    }
    existing.records.push(record)
    const dateKey = getDateKey(record.createdAt)
    const timestamp = getTimestamp(record.createdAt)
    if (dateKey && (!existing.dateMap.has(dateKey) || timestamp > existing.dateMap.get(dateKey))) {
      existing.dateMap.set(dateKey, timestamp)
    }
    groups.set(key, existing)
  }

  const query = normalize(state.searchQuery)
  const prepared = [...groups.values()].map((group) => {
    const sortedRecords = [...group.records].sort((left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt))
    const latestRecord = sortedRecords[0]
    const dateEntries = [...group.dateMap.entries()].sort((left, right) => right[1] - left[1])
    const dateKeys = dateEntries.map(([dateKey]) => dateKey)
    return {
      ...latestRecord,
      latestRecordId: latestRecord.id,
      latestTimestamp: getTimestamp(latestRecord.createdAt),
      oldestTimestamp: dateEntries.length ? dateEntries[dateEntries.length - 1][1] : getTimestamp(latestRecord.createdAt),
      drinkCount: dateKeys.length || 1,
      drinkDatesLabel: formatDrinkDatesLabel(dateKeys),
      createdAtLabel: formatCalendarDate(latestRecord.createdAt),
      cellarYears: getCellarYears(latestRecord.vintage),
      labelImageDataUrl: sanitizeLabelImageUrl(sortedRecords.find((item) => item.labelImageDataUrl)?.labelImageDataUrl),
      searchableText: normalize([
        latestRecord.producer,
        latestRecord.wineName,
        latestRecord.region,
        latestRecord.country,
        latestRecord.vintage,
        latestRecord.abv,
        ...dateKeys,
        ...sortedRecords.map((item) => item.comment || ''),
      ].join(' ')),
    }
  }).filter((record) => !query || record.searchableText.includes(query))

  prepared.sort((left, right) => {
    if (state.recordSort === 'latest') {
      return right.latestTimestamp - left.latestTimestamp || compareAlphabetical(left, right)
    }
    if (state.recordSort === 'oldest') {
      return left.oldestTimestamp - right.oldestTimestamp || compareAlphabetical(left, right)
    }
    if (state.recordSort === 'most-consumed') {
      return right.drinkCount - left.drinkCount
        || right.latestTimestamp - left.latestTimestamp
        || compareAlphabetical(left, right)
    }
    return compareAlphabetical(left, right)
  })

  return prepared
}

function getRecordView() {
  const records = getPreparedRecords()
  const totalPages = Math.max(1, Math.ceil(records.length / state.pageSize))
  state.recordPage = clamp(state.recordPage, 1, totalPages)
  const startIndex = (state.recordPage - 1) * state.pageSize
  return {
    records,
    pagedRecords: records.slice(startIndex, startIndex + state.pageSize),
    totalPages,
  }
}

function resetRecordPage() {
  state.recordPage = 1
}

function renderPagination(totalPages) {
  if (totalPages <= 1) {
    refs.recordPagination.hidden = true
    refs.recordPagination.innerHTML = ''
    return
  }

  refs.recordPagination.hidden = false
  const pageButtons = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1
    return `
      <button class="page-button ${page === state.recordPage ? 'active' : ''}" data-page="${page}" type="button">${page}</button>
    `
  }).join('')

  refs.recordPagination.innerHTML = `
    <button class="page-nav" data-page-nav="prev" type="button" ${state.recordPage === 1 ? 'disabled' : ''}>Prev</button>
    <div class="page-list">${pageButtons}</div>
    <button class="page-nav" data-page-nav="next" type="button" ${state.recordPage === totalPages ? 'disabled' : ''}>Next</button>
  `

  refs.recordPagination.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      state.recordPage = Number(button.dataset.page)
      renderRecordList()
    })
  })

  refs.recordPagination.querySelectorAll('[data-page-nav]').forEach((button) => {
    button.addEventListener('click', () => {
      state.recordPage += button.dataset.pageNav === 'prev' ? -1 : 1
      renderRecordList()
    })
  })
}

function renderPreview() {
  if (!state.imageDataUrl) {
    refs.previewImage.hidden = true
    refs.previewImage.removeAttribute('src')
    refs.previewEmpty.hidden = false
    return
  }

  refs.previewImage.src = state.imageDataUrl
  refs.previewImage.hidden = false
  refs.previewEmpty.hidden = true
}

function renderExtraction() {
  if (!state.extraction) {
    refs.extractionBox.hidden = true
    refs.extractionFields.innerHTML = ''
    return
  }

  refs.extractionBox.hidden = false
  const fields = [
    ['Producer', state.extraction.producer || '-'],
    ['Wine Name', state.extraction.wineName || '-'],
    ['Vintage', state.extraction.vintage || '-'],
    ['Region', state.extraction.region || '-'],
    ['Country', state.extraction.country || '-'],
    ['Variety', state.extraction.grapeVariety || '-'],
    ['Confidence', `${Math.round((state.extraction.confidence || 0) * 100)}%`],
    ['Visible Text', (state.extraction.visibleText || []).join(', ') || '-'],
  ]

  refs.extractionFields.innerHTML = fields.map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `).join('')
}

function getSelectedCandidate() {
  return state.candidates.find((candidate) => candidate.id === state.selectedWineId) || null
}

function renderCandidates() {
  if (!state.candidates.length) {
    refs.candidateEmpty.hidden = false
    refs.candidateList.innerHTML = ''
    refs.saveForm.hidden = true
    return
  }

  refs.candidateEmpty.hidden = true
  refs.candidateList.innerHTML = state.candidates.map((candidate) => `
    <article class="candidate-card ${candidate.id === state.selectedWineId ? 'active' : ''}">
      <h3>${escapeHtml(candidate.producer)}</h3>
      <p class="record-subtitle">${escapeHtml(candidate.wineName)} · ${escapeHtml(candidate.region)}${candidate.region && candidate.country ? ', ' : ''}${escapeHtml(candidate.country)} · ${escapeHtml(candidate.vintage || 'NV')}</p>
      <div class="candidate-meta">
        <span class="chip">${escapeHtml(candidate.sweetnessLabel || 'Style TBD')}</span>
        <span class="chip">${escapeHtml(candidate.grapeVariety)}</span>
      </div>
      <p class="match-reasons">${escapeHtml(candidate.matchReasons.join(' · ') || '텍스트 기반 후보')}</p>
      <div class="candidate-actions">
        <span>${escapeHtml(candidate.matchScore.toFixed(1))} pts</span>
        <button class="candidate-select" data-wine-id="${candidate.id}" type="button">
          ${candidate.id === state.selectedWineId ? 'Selected' : 'Choose'}
        </button>
      </div>
    </article>
  `).join('')

  refs.candidateList.querySelectorAll('.candidate-select').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedWineId = button.dataset.wineId
      renderCandidates()
      renderSaveForm()
    })
  })
}

function renderRatingButtons() {
  refs.ratingGrid.innerHTML = ratingOptions.map((value) => {
    const icon = value % 1 === 0 ? 'star' : 'star_half'
    return `
      <button class="rating-star ${state.rating === value ? 'active' : ''}" data-rating="${value}" type="button">
        <span class="material-symbols-outlined">${icon}</span>
      </button>
    `
  }).join('')

  refs.ratingGrid.querySelectorAll('.rating-star').forEach((button) => {
    button.addEventListener('click', () => {
      state.rating = Number(button.dataset.rating)
      renderRatingButtons()
      refs.ratingReadout.textContent = `${state.rating.toFixed(1)} / 5.0 ${formatStarsText(state.rating)}`
    })
  })
}

function renderSaveForm() {
  const selected = getSelectedCandidate()
  refs.saveForm.hidden = !selected
  if (!selected) {
    refs.selectedSummary.textContent = '선택된 와인 없음'
    return
  }

  refs.selectedSummary.textContent = `${selected.producer} · ${selected.wineName} · ${selected.vintage || 'NV'}`
  refs.sweetnessInput.value = String(state.sweetness)
  refs.sweetnessReadout.textContent = getSweetnessLabel(state.sweetness)
  refs.ratingReadout.textContent = `${state.rating.toFixed(1)} / 5.0 ${formatStarsText(state.rating)}`
  refs.decisionAgainButton.classList.toggle('active', state.saveDecision === 'again')
  refs.decisionPassButton.classList.toggle('active', state.saveDecision === 'pass')
  refs.saveButton.textContent = state.saveDecision === 'again' ? 'Save to Ledger' : 'Save to Pass List'
}

function startEditRecord(record) {
  state.editingRecordId = record.id
  state.editingComment = record.comment || ''
  renderRecordList()
}

function cancelEditRecord() {
  state.editingRecordId = null
  state.editingComment = ''
  renderRecordList()
}

async function saveEditedComment(recordId) {
  await fetchJson(`/api/records/${recordId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment: state.editingComment }),
  })
  state.editingRecordId = null
  state.editingComment = ''
  await loadRecords()
  setStatus('코멘트를 수정했습니다.', 'success')
}

async function deleteRecord(recordId) {
  await fetch(`/api/records/${recordId}`, { method: 'DELETE' })
  await loadRecords()
}

function renderRecordList() {
  const { records, pagedRecords, totalPages } = getRecordView()
  refs.filterAgainButton.classList.toggle('active', state.recordFilter === 'again')
  refs.filterPassButton.classList.toggle('active', state.recordFilter === 'pass')
  refs.recordCount.textContent = `${records.length} wines · page ${state.recordPage}/${totalPages}`

  if (!records.length) {
    refs.recordEmpty.hidden = false
    refs.recordEmpty.textContent = state.recordFilter === 'again'
      ? '또 먹을 와인 기록이 없습니다.'
      : '다시 안 먹을 와인 기록이 없습니다.'
    refs.recordList.innerHTML = ''
    renderPagination(1)
    return
  }

  refs.recordEmpty.hidden = true
  refs.recordList.innerHTML = pagedRecords.map((record) => `
    <article class="record-card">
      <div class="record-thumb">
        ${record.labelImageDataUrl
          ? `<img src="${escapeHtml(record.labelImageDataUrl)}" alt="${escapeHtml(`${record.producer} ${record.wineName} 라벨 사진`)}" loading="lazy" />`
          : '<span class="material-symbols-outlined">wine_bar</span>'}
      </div>
      <div class="record-body">
        <div class="record-title">
          <div class="record-heading">
            <h3>${escapeHtml(record.producer)}</h3>
            <p class="record-subtitle">${escapeHtml(record.wineName)} · ${escapeHtml(record.region)}${record.region && record.country ? ', ' : ''}${escapeHtml(record.country)} · ${escapeHtml(record.vintage || 'NV')}</p>
          </div>
          <div class="stars">${formatStarsText(record.rating)}</div>
        </div>
        <div class="record-meta">
          <span class="chip chip-date">Latest ${escapeHtml(record.createdAtLabel)}</span>
          <span class="chip chip-points">${escapeHtml(record.rating.toFixed(1))} PTS</span>
          <span class="chip chip-style">${escapeHtml(record.sweetnessLabel || getSweetnessLabel(record.sweetness || 50))}</span>
          ${record.cellarYears ? `<span class="chip chip-cellared">Vintage ${escapeHtml(record.cellarYears)}Y</span>` : ''}
          ${Number.isFinite(record.abv) ? `<span class="chip chip-abv">${escapeHtml(record.abv.toFixed(1))}% ABV</span>` : ''}
          <span class="chip chip-frequency">${escapeHtml(record.drinkCount)} Days</span>
          <span class="chip ${record.drinkAgain ? 'chip-category-positive' : 'chip-category-negative'}">${escapeHtml(record.decisionLabel || (record.drinkAgain ? '또 먹을 와인' : '다시 안 먹을 와인'))}</span>
        </div>
        <div class="record-dates">Drank on ${escapeHtml(record.drinkDatesLabel)}</div>
        <p class="record-comment">${escapeHtml(record.comment || '코멘트 없음')}</p>
        ${state.editingRecordId === record.id ? `
          <div class="record-edit">
            <textarea id="edit-comment-${record.id}" maxlength="280">${escapeHtml(state.editingComment)}</textarea>
            <div class="record-actions">
              <button class="record-action primary" data-action="save-comment" data-record-id="${record.id}" type="button">최근 코멘트 저장</button>
              <button class="record-action" data-action="cancel-comment" type="button">취소</button>
            </div>
          </div>
        ` : `
          <div class="record-actions">
            <button class="record-action" data-action="edit-comment" data-record-id="${record.latestRecordId}" type="button">최근 코멘트 수정</button>
            <button class="record-action" data-action="delete-record" data-record-id="${record.latestRecordId}" type="button">최근 기록 삭제</button>
          </div>
        `}
      </div>
    </article>
  `).join('')
  renderPagination(totalPages)

  refs.recordList.querySelectorAll('[data-action="edit-comment"]').forEach((button) => {
    button.addEventListener('click', () => {
      const record = state.records.find((item) => item.id === button.dataset.recordId)
      if (record) startEditRecord(record)
    })
  })

  refs.recordList.querySelectorAll('[data-action="cancel-comment"]').forEach((button) => {
    button.addEventListener('click', cancelEditRecord)
  })

  refs.recordList.querySelectorAll('[data-action="save-comment"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const textarea = refs.recordList.querySelector(`#edit-comment-${button.dataset.recordId}`)
      state.editingComment = textarea.value
      try {
        await saveEditedComment(button.dataset.recordId)
      } catch (error) {
        setStatus(error.message, 'error')
      }
    })
  })

  refs.recordList.querySelectorAll('[data-action="delete-record"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await deleteRecord(button.dataset.recordId)
    })
  })
}

function buildPreferenceStats(records) {
  if (!records.length) return null

  const avgSweetness = records.reduce((sum, record) => sum + Number(record.sweetness || 0), 0) / records.length
  const avgRating = records.reduce((sum, record) => sum + Number(record.rating || 0), 0) / records.length
  const countryMap = new Map()

  for (const record of records) {
    const existing = countryMap.get(record.country) || { country: record.country, count: 0, totalRating: 0 }
    existing.count += 1
    existing.totalRating += Number(record.rating || 0)
    countryMap.set(record.country, existing)
  }

  const countries = [...countryMap.values()]
    .map((entry) => ({ ...entry, avgRating: entry.totalRating / entry.count }))
    .sort((left, right) => right.count - left.count || right.avgRating - left.avgRating)

  return { avgSweetness, avgRating, countries }
}

function renderTasteMap() {
  const records = state.records.filter((record) => record.drinkAgain)
  const stats = buildPreferenceStats(records)

  if (!stats) {
    refs.tasteEmpty.hidden = false
    refs.tasteMap.hidden = true
    refs.tasteGrid.innerHTML = ''
    refs.tasteSummary.textContent = '또 먹을 와인이 쌓이면 내 취향 좌표를 그립니다.'
    return
  }

  refs.tasteEmpty.hidden = true
  refs.tasteMap.hidden = false
  refs.tasteSummary.textContent = `또 먹을 와인 기준 평균 취향은 ${getSweetnessLabel(stats.avgSweetness)} 쪽이고, 평균 평점은 ${stats.avgRating.toFixed(1)}점입니다.`

  refs.tasteGrid.innerHTML = records.map((record) => {
    const x = clamp(Number(record.sweetness || 0), 0, 100)
    const y = clamp((Number(record.rating || 0) / 5) * 100, 0, 100)
    return `<span class="taste-point" style="left:${x}%; bottom:${y}%;" title="${escapeHtml(`${record.producer} ${record.wineName}`)}"></span>`
  }).join('') + `
    <span class="taste-average" style="left:${stats.avgSweetness}%; bottom:${(stats.avgRating / 5) * 100}%;" title="평균 취향"></span>
    <div class="taste-legend">작은 점은 각 기록, 큰 점은 평균 취향입니다.</div>
  `
}

function renderCountryBars() {
  const records = state.records.filter((record) => record.drinkAgain)
  const stats = buildPreferenceStats(records)

  if (!stats || !stats.countries.length) {
    refs.countryEmpty.hidden = false
    refs.countryBars.innerHTML = ''
    refs.countrySummary.textContent = '또 먹을 와인이 쌓이면 나라 선호도를 계산합니다.'
    return
  }

  refs.countryEmpty.hidden = true
  const topCountry = stats.countries[0]
  refs.countrySummary.textContent = `${topCountry.country}를 가장 자주 다시 마시고, 평균 평점은 ${topCountry.avgRating.toFixed(1)}점입니다.`
  const maxCount = Math.max(...stats.countries.map((entry) => entry.count))
  refs.countryBars.innerHTML = stats.countries.map((entry) => `
    <div class="country-bar">
      <div class="country-bar-head">
        <strong>${escapeHtml(entry.country)}</strong>
        <span>${escapeHtml(Math.round((entry.count / records.length) * 100))}%</span>
      </div>
      <div class="country-bar-track">
        <span class="country-bar-fill" style="width:${(entry.count / maxCount) * 100}%"></span>
      </div>
      <div class="country-bar-note">${escapeHtml(entry.count)} bottles · 평균 ${escapeHtml(entry.avgRating.toFixed(1))}점</div>
    </div>
  `).join('')
}

function renderInsights() {
  renderRecordList()
  renderTasteMap()
  renderCountryBars()
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Request failed.')
  return payload
}

async function downscaleImage(file) {
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const node = new Image()
      node.onload = () => resolve(node)
      node.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'))
      node.src = sourceUrl
    })

    const maxEdge = 1400
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.9)
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

async function loadMeta() {
  state.meta = await fetchJson('/api/meta')
}

async function loadRecords() {
  const payload = await fetchJson('/api/records')
  state.records = (payload.records || []).map((record) => ({
    ...record,
    sweetness: Number.isFinite(Number(record.sweetness)) ? Number(record.sweetness) : 50,
    sweetnessLabel: record.sweetnessLabel || getSweetnessLabel(Number(record.sweetness) || 50),
    abv: Number.isFinite(Number(record.abv)) ? Number(record.abv) : null,
    labelImageDataUrl: sanitizeLabelImageUrl(record.labelImageDataUrl),
    drinkAgain: record.drinkAgain !== false,
    decisionLabel: record.decisionLabel || (record.drinkAgain !== false ? '또 먹을 와인' : '다시 안 먹을 와인'),
  }))
  if (state.editingRecordId && !state.records.some((record) => record.id === state.editingRecordId)) {
    state.editingRecordId = null
    state.editingComment = ''
  }
  renderInsights()
}

function resetScanState() {
  state.fileName = ''
  state.imageDataUrl = ''
  state.extractionMode = null
  state.extraction = null
  state.candidates = []
  state.selectedWineId = null
  state.rating = 0
  state.sweetness = 50
  state.saveDecision = 'again'
  refs.abvInput.value = ''
  refs.commentInput.value = ''
  refs.imageInput.value = ''
  renderPreview()
  renderExtraction()
  renderCandidates()
  renderSaveForm()
  setStatus('아직 스캔 전입니다.')
}

refs.imageInput.addEventListener('change', async (event) => {
  const [file] = event.target.files || []
  if (!file) {
    resetScanState()
    return
  }

  state.fileName = file.name
  state.imageDataUrl = await downscaleImage(file)
  renderPreview()
  setStatus(`업로드 완료: ${file.name}`)
})

refs.scanButton.addEventListener('click', async () => {
  if (!state.imageDataUrl) {
    setStatus('먼저 이미지를 올려주세요.', 'error')
    return
  }

  state.selectedWineId = null
  refs.saveForm.hidden = true
  setStatus('Information Scanning / Searching...', 'loading')

  try {
    const payload = await fetchJson('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: state.imageDataUrl,
        fileName: state.fileName,
      }),
    })
    state.extractionMode = payload.mode
    state.extraction = payload.extraction
    state.candidates = payload.candidates || []
    renderExtraction()
    renderCandidates()
    renderSaveForm()
    if (state.candidates.length) {
      setStatus(`후보 ${state.candidates.length}개를 찾았습니다. 하나를 선택해 저장하세요.`, 'success')
    } else {
      setStatus('현재 카탈로그에서 신뢰할 후보를 찾지 못했습니다.', 'error')
    }
  } catch (error) {
    setStatus(error.message, 'error')
  }
})

refs.sweetnessInput.addEventListener('input', () => {
  state.sweetness = Number(refs.sweetnessInput.value)
  refs.sweetnessReadout.textContent = getSweetnessLabel(state.sweetness)
})

refs.decisionAgainButton.addEventListener('click', () => {
  state.saveDecision = 'again'
  renderSaveForm()
})

refs.decisionPassButton.addEventListener('click', () => {
  state.saveDecision = 'pass'
  renderSaveForm()
})

refs.saveForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!state.selectedWineId) {
    setStatus('저장할 후보를 먼저 선택해주세요.', 'error')
    return
  }
  if (state.rating <= 0) {
    setStatus('별점을 선택해주세요.', 'error')
    return
  }

  try {
    await fetchJson('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wineId: state.selectedWineId,
        rating: state.rating,
        sweetness: state.sweetness,
        abv: refs.abvInput.value.trim() ? Number(refs.abvInput.value) : null,
        comment: refs.commentInput.value.trim(),
        imageName: state.fileName,
        labelImageDataUrl: state.imageDataUrl,
        extractionMode: state.extractionMode,
        drinkAgain: state.saveDecision === 'again',
      }),
    })
    state.recordFilter = state.saveDecision
    refs.commentInput.value = ''
    refs.abvInput.value = ''
    state.rating = 0
    state.sweetness = 50
    state.saveDecision = 'again'
    renderSaveForm()
    await loadRecords()
    setStatus('기록을 저장했습니다.', 'success')
  } catch (error) {
    setStatus(error.message, 'error')
  }
})

refs.filterAgainButton.addEventListener('click', () => {
  state.recordFilter = 'again'
  resetRecordPage()
  renderRecordList()
})

refs.filterPassButton.addEventListener('click', () => {
  state.recordFilter = 'pass'
  resetRecordPage()
  renderRecordList()
})

refs.recordSearch.addEventListener('input', () => {
  state.searchQuery = refs.recordSearch.value
  resetRecordPage()
  renderRecordList()
})

refs.recordSort.addEventListener('change', () => {
  state.recordSort = refs.recordSort.value
  resetRecordPage()
  renderRecordList()
})

await loadMeta()
await loadRecords()
renderPreview()
renderExtraction()
renderCandidates()
renderRatingButtons()
renderSaveForm()
