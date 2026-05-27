# SDG Scraper

Desktop application for scraping social media pages and websites, then automatically tagging posts with [UN Sustainable Development Goals (SDGs)](https://sdgs.un.org/goals) based on hashtag and keyword matching.

Built with Electron + React + Tailwind CSS.

---

## Features

- **Page Manager** — Add Facebook pages or WordPress sites as scrape targets
- **Job Runner** — Start scrape jobs with real-time progress streaming
- **Results** — Browse SDG-tagged posts, filter by SDG number (1–17) or platform, export to CSV / XLSX
- **SDG Tagging** — Dual matching: hashtag-first (higher confidence), keyword fallback (lower confidence)
- **Keyword expansion** — Slash variants, British/American spelling pairs, loaded from `keywords.xlsx`
- **SQLite storage** — Local database in Electron's userData directory, schema migrations built-in

---

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** 10+
- **Python 3** (required by node-gyp to build `better-sqlite3` native module)
- **Windows**: Visual Studio Build Tools with C++ workload, OR run `npm install --global windows-build-tools`
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)

---

## Setup

```bash
# 1. Install dependencies (skip scripts to avoid premature native rebuild)
npm install --ignore-scripts

# 2. Rebuild better-sqlite3 against Electron's Node ABI
npm run rebuild

# 3. Start in development mode (hot reload)
npm run dev
```

> **Why two steps?** `better-sqlite3` is a native module that must be compiled against
> Electron's specific Node.js ABI version, not the system Node.js. Running
> `--ignore-scripts` first installs all packages, then `npm run rebuild` compiles
> the binary with the correct target.

### First launch

On first launch the app will:
1. Create `sdg-scraper.db` in your OS userData directory (`%APPDATA%\sdg-scraper` on Windows, `~/Library/Application Support/sdg-scraper` on Mac)
2. Run the initial migration creating all tables
3. Open the Electron window with the React UI

---

## Keywords file

Place your SDG keyword spreadsheet at:
```
src/tagging/keywords.xlsx
```

**Required sheet:** `Compiled SDG Keywords`  
**Structure:** Each column = one SDG. Row 1 = header (e.g. `SDG 1`, `SDG 2`, …). Rows 2+ = keywords.

Keywords are loaded once at startup. Slash variants and British/American spelling pairs are expanded automatically. See `src/tagging/keywords.js` for the expansion logic.

> The file is not included in this repository. If missing, the tagging engine will fall back to hashtag-only matching (no keyword matching).

---

## Building / Packaging

```bash
# Build for current platform
npm run dist

# Windows only (run on Windows or with Wine)
npm run dist:win

# macOS only
npm run dist:mac
```

Output goes to the `dist/` folder.

**Windows:** Produces an NSIS installer (`.exe`)  
**macOS:** Produces a DMG (`.dmg`)

---

## Architecture

```
src/
├── main.js           — Electron main process entry
├── preload.js        — contextBridge IPC surface (window.api)
│
├── ipc/
│   └── handlers.js   — All ipcMain.handle registrations
│
├── storage/
│   ├── db.js         — Open DB + migration runner
│   └── migrations/
│       └── 001_initial.sql
│
├── tagging/
│   ├── sdg-metadata.js  — All 17 SDGs: number, name, slug, abbreviations
│   ├── keywords.js      — Load + expand keywords.xlsx
│   ├── engine.js        — tagPost(post) → [{sdgNumber, confidence, matchedOn}]
│   └── keywords.xlsx    — Keyword source (not in repo — add your own)
│
├── adapters/
│   ├── base.adapter.js      — Abstract BaseAdapter + helpers
│   ├── facebook.adapter.js  — Playwright-based (stub — see TODO comments)
│   └── wordpress.adapter.js — WP REST API (functional) + Playwright fallback (stub)
│
├── scraper/
│   └── manager.js    — Adapter registry + job execution pipeline
│
└── renderer/         — React app
    ├── main.jsx
    ├── App.jsx        — HashRouter + sidebar nav
    ├── index.css      — Tailwind + design tokens
    └── pages/
        ├── PageManager.jsx
        ├── JobRunner.jsx
        └── Results.jsx
```

### IPC channels

| Channel | Direction | Description |
|---------|-----------|-------------|
| `pages:list` | renderer → main | List all saved pages |
| `pages:add` | renderer → main | Add a page |
| `pages:remove` | renderer → main | Remove a page |
| `jobs:start` | renderer → main | Start a scrape job, returns `{ jobId }` |
| `jobs:list` | renderer → main | List recent jobs |
| `jobs:getStatus` | renderer → main | Get single job status |
| `posts:query` | renderer → main | Query posts with filters |
| `posts:export` | renderer → main | Fetch all matching posts for export |
| `sdg:getMetadata` | renderer → main | Get all 17 SDG metadata objects |
| `job:progress` | main → renderer | Push updates during a running job |

---

## Adding a new adapter

1. **Create** `src/adapters/{platform}.adapter.js`

```js
import { BaseAdapter } from './base.adapter.js'

export class MyPlatformAdapter extends BaseAdapter {
  async scrape(pageConfig) {
    // Fetch posts...
    return posts.map(p => this.normalizePost({
      id:       `myplatform:${pageConfig.pageId}:${p.nativeId}`,
      platform: 'myplatform',
      pageId:   pageConfig.pageId,
      text:     p.body,
      hashtags: [],        // or extract with extractHashtags(p.body)
      date:     p.date,
      url:      p.url,
      author:   p.author,
      rawHtml:  p.html,
    }))
  }
}
```

2. **Register** in `src/scraper/manager.js`:

```js
import { MyPlatformAdapter } from '../adapters/myplatform.adapter.js'

const ADAPTERS = {
  // ...existing
  myplatform: MyPlatformAdapter,
}
```

3. **Add** the platform to the `<select>` in `src/renderer/pages/PageManager.jsx`:

```jsx
const PLATFORMS = [
  { value: 'facebook',   label: 'Facebook'   },
  { value: 'wordpress',  label: 'WordPress'  },
  { value: 'myplatform', label: 'My Platform' },
]
```

That's it. The IPC layer, scraper manager, tagging engine, and storage pipeline all pick up the new platform automatically.

---

## Facebook setup

Facebook requires a manual login session before automated scraping can work. The `FacebookAdapter` is scaffolded with detailed TODO comments covering:

- Persistent Chromium context (`launchPersistentContext`)
- Session save/restore via `storageState`
- Infinite scroll loop
- Post extraction selectors

See `src/adapters/facebook.adapter.js` for the full implementation guide.

---

## SDG hashtag variants

Hashtag variants are generated programmatically at startup from `src/tagging/sdg-metadata.js`. For each SDG the following patterns are generated (example for SDG 3):

```
sdg3, sdg03, unsdg3, unsdg03
sdg3goodhealthandwellbeing, unsdg3goodhealthandwellbeing
goodhealthandwellbeing
goodhealth, goodhealthwellbeing, healthforall   ← abbreviations
sdg3goodhealth, unsdg3goodhealth, ...           ← prefixed abbreviations
```

To add more variants for an SDG, edit the `abbreviations` array in `src/tagging/sdg-metadata.js`.

---

## License

MIT
