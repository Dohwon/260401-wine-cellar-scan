# Wine Cellar Scan

Upload one bottle photo, extract label data with vision OCR, confirm the best match, and save it into a personal wine ledger.

## Features

- Vision-based extraction from a bottle label image
- Candidate matching using `producer`, `wine name`, `vintage`, region, and grape variety
- Manual confirmation before saving
- Personal tasting notes with 0.5-step ratings
- Sweetness / dryness preference input
- `Drink again` and `Pass` tabs
- One cellar card per wine, with unique drinking-day count
- Sort by `ABC`, `latest`, `oldest`, or `most consumed`
- Pagination with 5 wines per page
- Taste map and country preference analytics

## Tech Stack

- Vanilla HTML, CSS, and browser-side JavaScript
- Node.js HTTP server
- OpenAI Responses API for image understanding / OCR
- Local JSON persistence for MVP data

## Quick Start

1. Install dependencies.
2. Add your own API key to `.env`.
3. Start the server.

```bash
npm install
npm start
```

Open `http://127.0.0.1:4321`.

## Environment Variables

Create a `.env` file in the project root.

Required for live OCR:

```bash
OPENAI_API_KEY=your_openai_api_key
```

Optional:

```bash
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
PORT=4321
GOOGLE_SEARCH_API_KEY=your_google_search_api_key
GOOGLE_SEARCH_CX=your_google_custom_search_engine_id
```

If `OPENAI_API_KEY` is missing, the app falls back to simulation mode.

## Data Files

- `data/wine-catalog.json`: local seed catalog
- `data/external-catalog-cache.json`: external/OCR fallback cache
- `data/cellar-records.json`: tasting records
- `data/wine-labels.json`: one saved label image per wine

## Notes

- This project is still an MVP and uses local JSON files instead of a production database.
- Official licensed wine databases such as Wine-Searcher require their own commercial API access and credentials.
- On Railway or other cloud hosts, persistent storage should be replaced with a real database or a mounted volume.
