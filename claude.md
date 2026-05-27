# SDG Tagger

Desktop app (Electron + React) that scrapes pages and tags posts with UN SDGs.

## Stack
- Electron + React + Tailwind CSS
- Playwright (scraping)
- better-sqlite3 (storage)
- xlsx (keyword file parsing)
- electron-builder (packaging, Windows primary)

## Architecture
Adapter pattern — all scrapers implement `src/adapters/base.adapter.js`.
Scrapers output normalized posts; the tagging engine consumes them.
Electron ↔ React communication via IPC only (never expose Node APIs directly).

## Normalized Post Schema
```js
{ id, platform, pageId, text, hashtags, date, url, author, rawHtml }
```

## Key Paths
- `src/adapters/` — platform scrapers
- `src/tagging/keywords.xlsx` — keyword source file (do not modify structure)
- `src/tagging/sdg-metadata.js` — SDG numbers, names, slugs, abbreviations
- `src/tagging/engine.js` — matching logic
- `src/storage/migrations/` — schema changes go here
- `src/main.js` — Electron main process
- `src/preload.js` — IPC bridge

## SDG Tagging
Match order: hashtag → keyword.
Confidence levels: `hashtag`, `keyword`.
AI fallback: stubbed, disabled by default.

**Keyword matching**
- Sheet: "Compiled SDG Keywords". Each column = one SDG. Row 1 = header. Remaining rows = keywords.
- Expand slash variants on load: "Child labor/labour" → ["Child labor", "Child labour"]; "effect/s" → ["effect", "effects"]
- Also expand British/American spelling pairs automatically (e.g. organisation/organization, behaviour/behavior)
- Match: exact whole-word, case-insensitive. No fuzzy.

**Hashtag matching**
- Normalize: strip #, lowercase, remove all separators
- Generate variations programmatically from sdg-metadata.js — never hardcode per SDG
- Patterns: sdgN, sdg0N, unsdgN, unsdg0N, sdgN{slug}, unsdgN{slug}, {slug}, {abbreviation}

## Adding a New Adapter
1. Create `src/adapters/{platform}.adapter.js`
2. Extend `BaseAdapter`, implement `scrape(pageConfig)`
3. Return normalized post array
4. Register in `src/scraper/manager.js`

## Platform Notes
- **Facebook** — requires saved Playwright session, randomized delays (1.5–4s)
- **WordPress** — use REST API (`/wp-json/wp/v2/posts`) before falling back to Playwright

## UI Guidelines
Use the ui-ux-pro-max skill for all UI components and screens.
Target style: Data-Dense Dashboard (internal tool, not marketing).
Stack: React + Tailwind CSS.

## Documentation
Use Context7 to fetch live docs before implementing any of these:
- Playwright (browser automation, auth state, page interactions)
- Electron (IPC, contextBridge, main/renderer communication)
- better-sqlite3 (query API, migrations)
- xlsx (sheet parsing, data extraction)