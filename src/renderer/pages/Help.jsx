/**
 * pages/Help.jsx
 *
 * In-app user manual for SDG Scraper.
 * Two-column layout: sticky TOC on the left, scrollable content on the right.
 */

import { useEffect, useRef, useState } from 'react'

// ─── Keywords file path loader ────────────────────────────────────────────────

function useKeywordsPath() {
  const [path, setPath] = useState(null)
  useEffect(() => {
    window.api.keywords.getPath().then(setPath).catch(() => {})
  }, [])
  return path
}

// ─── Colour chips for SDG badges in the manual ───────────────────────────────

const SDG_COLORS = {
  1:'#E5243B', 2:'#DDA63A', 3:'#4C9F38', 4:'#C5192D', 5:'#FF3A21',
  6:'#26BDE2', 7:'#FCC30B', 8:'#A21942', 9:'#FD6925', 10:'#DD1367',
  11:'#FD9D24', 12:'#BF8B2E', 13:'#3F7E44', 14:'#0A97D9', 15:'#56C02B',
  16:'#00689D', 17:'#19486A',
}

const SDG_NAMES = {
  1:'No Poverty', 2:'Zero Hunger', 3:'Good Health and Well-Being',
  4:'Quality Education', 5:'Gender Equality', 6:'Clean Water and Sanitation',
  7:'Affordable and Clean Energy', 8:'Decent Work and Economic Growth',
  9:'Industry, Innovation and Infrastructure', 10:'Reduced Inequalities',
  11:'Sustainable Cities and Communities', 12:'Responsible Consumption and Production',
  13:'Climate Action', 14:'Life Below Water', 15:'Life on Land',
  16:'Peace, Justice and Strong Institutions', 17:'Partnerships for the Goals',
}

// ─── TOC structure ────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'overview',     label: 'Overview' },
  { id: 'quick-start',  label: 'Quick Start' },
  { id: 'pages',        label: '1. Pages' },
  { id: 'jobs',         label: '2. Jobs' },
  { id: 'results',      label: '3. Results' },
  { id: 'dashboard',    label: '4. Dashboard' },
  { id: 'sdgs',         label: 'The 17 SDGs' },
  { id: 'tagging',      label: 'How Tagging Works' },
  { id: 'keywords',     label: 'Editing Keywords' },
  { id: 'export',       label: 'Exporting Data' },
  { id: 'tips',         label: 'Tips & Troubleshooting' },
]

// ─── Small reusable prose components ─────────────────────────────────────────

function H2({ id, children }) {
  return (
    <h2 id={id} className="text-base font-semibold text-slate-100 mt-10 mb-3 scroll-mt-6 flex items-center gap-2">
      {children}
    </h2>
  )
}

function H3({ children }) {
  return <h3 className="text-sm font-semibold text-slate-200 mt-5 mb-2">{children}</h3>
}

function P({ children }) {
  return <p className="text-sm text-slate-400 leading-relaxed mb-3">{children}</p>
}

function Li({ children }) {
  return (
    <li className="text-sm text-slate-400 leading-relaxed flex gap-2">
      <span className="text-slate-600 mt-0.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  )
}

function Ul({ children }) {
  return <ul className="space-y-1.5 mb-3">{children}</ul>
}

function Note({ children }) {
  return (
    <div className="flex gap-2.5 bg-blue-900/20 border border-blue-800/40 rounded px-3 py-2.5 mb-3">
      <span className="text-blue-400 shrink-0 mt-0.5">ℹ</span>
      <p className="text-xs text-blue-300/80 leading-relaxed">{children}</p>
    </div>
  )
}

function Warn({ children }) {
  return (
    <div className="flex gap-2.5 bg-amber-900/20 border border-amber-800/40 rounded px-3 py-2.5 mb-3">
      <span className="text-amber-400 shrink-0 mt-0.5">⚠</span>
      <p className="text-xs text-amber-300/80 leading-relaxed">{children}</p>
    </div>
  )
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3 mb-3">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 text-xs font-bold shrink-0 mt-0.5">
        {n}
      </span>
      <p className="text-sm text-slate-400 leading-relaxed">{children}</p>
    </div>
  )
}

function Badge({ label, color = '#3B82F6' }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white mx-0.5"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  )
}

function StatusChip({ status }) {
  const styles = {
    pending: 'bg-slate-700 text-slate-300',
    running: 'bg-blue-900/60 text-blue-300',
    tagging: 'bg-amber-900/60 text-amber-300',
    done:    'bg-green-900/60 text-green-300',
    error:   'bg-red-900/60 text-red-300',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium mx-0.5 ${styles[status]}`}>
      {status}
    </span>
  )
}

function Divider() {
  return <hr className="border-slate-800 my-8" />
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Help() {
  const [activeId, setActiveId]       = useState('overview')
  const [kwError, setKwError]         = useState(null)
  const contentRef = useRef(null)
  const keywordsPath = useKeywordsPath()

  // Highlight active TOC entry based on scroll position
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { root: el, rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    )

    SECTIONS.forEach(({ id }) => {
      const target = el.querySelector(`#${id}`)
      if (target) observer.observe(target)
    })

    return () => observer.disconnect()
  }, [])

  function scrollTo(id) {
    const el = contentRef.current?.querySelector(`#${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex h-full">

      {/* ── Sticky TOC ── */}
      <aside className="w-44 shrink-0 border-r border-slate-800 overflow-y-auto py-6 px-3 sticky top-0 h-full">
        <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest mb-3 px-2">
          Contents
        </p>
        <nav>
          <ul className="space-y-0.5">
            {SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <button
                  onClick={() => scrollTo(id)}
                  className={[
                    'w-full text-left px-2 py-1.5 rounded text-xs transition-colors duration-100',
                    activeId === id
                      ? 'bg-blue-600/20 text-blue-400 font-medium'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800',
                  ].join(' ')}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* ── Scrollable content ── */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl px-8 py-8 pb-24">

          {/* ── Overview ── */}
          <H2 id="overview">Overview</H2>
          <P>
            <strong className="text-slate-200">SDG Scraper</strong> is a desktop application that automatically collects posts from social media pages and websites, then analyses them to identify which of the United Nations' <strong className="text-slate-200">17 Sustainable Development Goals (SDGs)</strong> each post relates to.
          </P>
          <P>
            You do not need any technical knowledge to use it. The app handles the collection, analysis, and storage automatically. Your job is simply to tell it <em>which pages to watch</em>, then <em>start a scrape</em> whenever you want fresh data.
          </P>

          <H3>What it does</H3>
          <Ul>
            <Li>Visits websites and social media pages you specify and collects their posts.</Li>
            <Li>Reads each post and looks for SDG-related hashtags (e.g. <code className="text-blue-300 text-xs">#ClimateAction</code>) and keywords (e.g. "poverty", "clean water").</Li>
            <Li>Labels each post with the SDG(s) it relates to and stores everything locally on your computer.</Li>
            <Li>Lets you browse, filter, and export the results at any time.</Li>
          </Ul>

          <H3>The four sections</H3>
          <Ul>
            <Li><strong className="text-slate-300">Dashboard</strong> — charts and metrics summarising everything collected so far.</Li>
            <Li><strong className="text-slate-300">Pages</strong> — manage which websites or social media pages to scrape.</Li>
            <Li><strong className="text-slate-300">Jobs</strong> — run a scrape and watch it progress in real time.</Li>
            <Li><strong className="text-slate-300">Results</strong> — browse every collected post with its SDG tags, with filters and export.</Li>
          </Ul>

          <Divider />

          {/* ── Quick Start ── */}
          <H2 id="quick-start">Quick Start</H2>
          <P>New to the app? Follow these four steps to get your first results.</P>

          <Step n={1}>
            Go to <strong className="text-slate-200">Pages</strong> in the sidebar. Click <strong className="text-slate-200">+ Add</strong> and enter the URL of a WordPress blog or Facebook page you want to monitor. Give it a label so you can recognise it later.
          </Step>
          <Step n={2}>
            Go to <strong className="text-slate-200">Jobs</strong>. Select the page you just added from the dropdown and click <strong className="text-slate-200">▶ Start Scrape</strong>.
          </Step>
          <Step n={3}>
            Watch the progress card. The status will move from <StatusChip status="running" /> to <StatusChip status="tagging" /> to <StatusChip status="done" />. This usually takes a few seconds to a few minutes depending on how many posts the page has.
          </Step>
          <Step n={4}>
            Go to <strong className="text-slate-200">Results</strong> to browse the collected posts, or <strong className="text-slate-200">Dashboard</strong> to see charts and summaries.
          </Step>

          <Note>
            WordPress sites work out of the box. Facebook requires a saved login session — see the Tips section for details.
          </Note>

          <Divider />

          {/* ── Pages ── */}
          <H2 id="pages">1. Pages</H2>
          <P>
            A <strong className="text-slate-200">page</strong> is a source — a website or social media account — that you want the app to collect posts from. You must add at least one page before you can run a scrape.
          </P>

          <H3>Adding a page</H3>
          <Ul>
            <Li><strong className="text-slate-300">Platform</strong> — choose <em>WordPress</em> for any WordPress-powered blog or website, or <em>Facebook</em> for a Facebook page.</Li>
            <Li><strong className="text-slate-300">URL</strong> — paste the full web address, including <code className="text-blue-300 text-xs">https://</code>. For Facebook, use the page URL (e.g. <code className="text-blue-300 text-xs">https://facebook.com/YourPage</code>).</Li>
            <Li><strong className="text-slate-300">Label</strong> (optional) — a friendly name shown throughout the app. If left blank, the URL is used instead.</Li>
          </Ul>
          <P>Click <strong className="text-slate-200">+ Add</strong> to save. The page appears in the table below immediately.</P>

          <H3>Removing a page</H3>
          <P>
            Click <strong className="text-slate-200">Remove</strong> next to a page. This only removes the page record — any posts already collected from it are kept.
          </P>

          <Note>
            The <strong>Page ID</strong> column shows the internal identifier the app uses to match posts to their source. For WordPress sites it is the hostname; for Facebook it is the page name from the URL.
          </Note>

          <Divider />

          {/* ── Jobs ── */}
          <H2 id="jobs">2. Jobs</H2>
          <P>
            A <strong className="text-slate-200">job</strong> is a single scrape run. Each time you click Start Scrape, the app visits the page, collects all available posts, tags them with SDGs, and saves them. Running the same page multiple times is safe — duplicate posts are ignored.
          </P>

          <H3>Starting a scrape</H3>
          <Ul>
            <Li>Select a page from the <strong className="text-slate-300">Page</strong> dropdown.</Li>
            <Li>Click <strong className="text-slate-300">▶ Start Scrape</strong>.</Li>
            <Li>A progress card appears below the button showing live status and elapsed time.</Li>
          </Ul>

          <H3>Job statuses</H3>
          <Ul>
            <Li><StatusChip status="running" /> — the app is visiting the page and collecting posts.</Li>
            <Li><StatusChip status="tagging" /> — posts have been collected; the app is now reading and tagging each one.</Li>
            <Li><StatusChip status="done" /> — the scrape finished successfully. The posts count shows how many were processed.</Li>
            <Li><StatusChip status="error" /> — something went wrong. The error message is shown in the job row. Check your URL is correct and the site is reachable.</Li>
          </Ul>

          <H3>Job history</H3>
          <P>
            The <strong className="text-slate-200">Recent jobs</strong> table shows up to 100 past runs with their start time, finish time, and post count. You can delete any completed job by clicking <strong className="text-slate-200">Remove</strong> — this also removes all posts collected during that specific run.
          </P>

          <Warn>
            You cannot delete a job while it is still running. Wait for it to finish first.
          </Warn>

          <Divider />

          {/* ── Results ── */}
          <H2 id="results">3. Results</H2>
          <P>
            The Results page shows every post that has been collected and tagged. You can filter, browse, and export from here.
          </P>

          <H3>Filters</H3>
          <Ul>
            <Li><strong className="text-slate-300">Filter by SDG</strong> — click any numbered SDG button to show only posts tagged with that goal. Click it again to clear. The button expands to show the goal name when active.</Li>
            <Li><strong className="text-slate-300">Platform</strong> — narrow results to WordPress or Facebook posts only.</Li>
            <Li><strong className="text-slate-300">Page</strong> — show posts from a single specific source. Selecting a platform first narrows the page list automatically.</Li>
          </Ul>

          <H3>Reading the table</H3>
          <Ul>
            <Li><strong className="text-slate-300">Date</strong> — when the post was originally published (not when it was scraped).</Li>
            <Li><strong className="text-slate-300">Text preview</strong> — the first few lines of the post. Click the URL beneath it to open the original in your browser.</Li>
            <Li><strong className="text-slate-300">SDGs</strong> — coloured numbered badges for each SDG the post was tagged with. Hover over a badge to see the full goal name.</Li>
            <Li><strong className="text-slate-300">Confidence</strong> — how the tag was determined: <Badge label="hashtag" color="#3B82F6" /> means a recognised SDG hashtag was found; <Badge label="keyword" color="#475569" /> means a keyword from the SDG keyword list matched.</Li>
            <Li><strong className="text-slate-300">Matched on</strong> — the exact hashtag or keyword that triggered the tag.</Li>
          </Ul>

          <H3>Pagination</H3>
          <P>Results are shown 50 at a time. Use the <strong className="text-slate-200">← Prev</strong> and <strong className="text-slate-200">Next →</strong> buttons at the top-right of the table to navigate between pages.</P>

          <Divider />

          {/* ── Dashboard ── */}
          <H2 id="dashboard">4. Dashboard</H2>
          <P>
            The Dashboard gives you a bird's-eye view of everything collected. All charts and tables update instantly when you change the filters at the top.
          </P>

          <H3>Filters</H3>
          <P>Use the <strong className="text-slate-200">Platform</strong> and <strong className="text-slate-200">Page</strong> dropdowns at the top right to focus all charts on a specific source. Click <strong className="text-slate-200">↺ Refresh</strong> to reload data after a new scrape.</P>

          <H3>What each section shows</H3>
          <Ul>
            <Li><strong className="text-slate-300">KPI cards</strong> — four headline numbers: total posts collected, tagged posts and coverage percentage, total SDG tags assigned, and the most-tagged SDG goal.</Li>
            <Li><strong className="text-slate-300">Posts by SDG</strong> — a horizontal bar chart showing how many posts relate to each of the 17 goals. Longer bar = more posts. Zero-count goals show an empty bar.</Li>
            <Li><strong className="text-slate-300">Match confidence</strong> — proportion of tags found via hashtag versus keyword matching.</Li>
            <Li><strong className="text-slate-300">Posts by platform</strong> — split between WordPress and Facebook sources.</Li>
            <Li><strong className="text-slate-300">Posts over time</strong> — a monthly bar chart of post publication dates (not scrape dates). Hover a bar to see the exact count. Scroll horizontally if there are many months.</Li>
            <Li><strong className="text-slate-300">Coverage by page</strong> — how many posts have been collected from each source.</Li>
            <Li><strong className="text-slate-300">Top matched terms</strong> — the hashtags and keywords that triggered the most SDG tags, with the goal each term maps to.</Li>
            <Li><strong className="text-slate-300">Recent jobs</strong> — a summary of the last 5 scrape runs.</Li>
          </Ul>

          <Divider />

          {/* ── The 17 SDGs ── */}
          <H2 id="sdgs">The 17 SDGs</H2>
          <P>
            The United Nations' Sustainable Development Goals are a set of 17 global goals adopted in 2015, targeting the world's most pressing challenges by 2030. Each goal has an official colour and number used consistently across the app.
          </P>

          <div className="grid grid-cols-1 gap-1.5 mb-4">
            {Array.from({ length: 17 }, (_, i) => i + 1).map(n => (
              <div key={n} className="flex items-center gap-3">
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: SDG_COLORS[n] }}
                >
                  {n}
                </span>
                <span className="text-sm text-slate-300">{SDG_NAMES[n]}</span>
              </div>
            ))}
          </div>

          <Note>
            Hover over any coloured SDG badge anywhere in the app to see the full goal name as a tooltip.
          </Note>

          <Divider />

          {/* ── How Tagging Works ── */}
          <H2 id="tagging">How Tagging Works</H2>
          <P>
            After collecting posts, the app automatically reads each one and tries to link it to one or more SDGs. It uses two methods, in order:
          </P>

          <H3>1. Hashtag matching (higher confidence)</H3>
          <P>
            The app scans the hashtags in each post (e.g. <code className="text-blue-300 text-xs">#SDG13</code>, <code className="text-blue-300 text-xs">#ClimateAction</code>, <code className="text-blue-300 text-xs">#ZeroHunger</code>). It recognises hundreds of common SDG hashtag variants including numbered forms (<code className="text-blue-300 text-xs">#SDG3</code>, <code className="text-blue-300 text-xs">#SDG03</code>, <code className="text-blue-300 text-xs">#UNSDG3</code>), full goal names, abbreviations, and campaign hashtags like <code className="text-blue-300 text-xs">#HeForShe</code> or <code className="text-blue-300 text-xs">#GlobalWarming</code>.
          </P>
          <P>
            A hashtag match is shown with a <Badge label="hashtag" color="#3B82F6" /> confidence badge — it is the most reliable signal.
          </P>

          <H3>2. Keyword matching (standard confidence)</H3>
          <P>
            If no SDG hashtag is found, the app scans the full text of the post for keywords from a curated SDG keyword list (loaded from <code className="text-blue-300 text-xs">keywords.xlsx</code>). The match must be an exact whole word — for example, "poverty" matches but "impoverishment" does not. British and American spellings are both recognised automatically (e.g. "organisation" and "organization").
          </P>
          <P>
            A keyword match is shown with a <Badge label="keyword" color="#475569" /> confidence badge.
          </P>

          <H3>Important notes</H3>
          <Ul>
            <Li>A post can be tagged with <strong className="text-slate-300">multiple SDGs</strong> if it contains hashtags or keywords from more than one goal.</Li>
            <Li>Posts with <strong className="text-slate-300">no matching hashtags or keywords</strong> are still saved but will not appear when filtering by SDG.</Li>
            <Li>Re-running a scrape on the same page is <strong className="text-slate-300">safe and idempotent</strong> — duplicate posts are skipped, not doubled up.</Li>
          </Ul>

          <Divider />

          {/* ── Editing Keywords ── */}
          <H2 id="keywords">Editing Keywords</H2>
          <P>
            The keyword list that drives SDG tagging lives in a file called <strong className="text-slate-200">keywords.xlsx</strong>. You can open and edit it in Excel, LibreOffice Calc, or any spreadsheet app — no technical knowledge required.
          </P>

          <H3>How the file is structured</H3>
          <Ul>
            <Li>Each <strong className="text-slate-300">column</strong> corresponds to one SDG (column A = SDG 1, column B = SDG 2, and so on up to column Q = SDG 17).</Li>
            <Li>The <strong className="text-slate-300">first row</strong> is a header row (e.g. "SDG 1 - No Poverty"). Do not delete or move it.</Li>
            <Li>Each row below the header is a keyword. Add new keywords by typing them into empty rows in the appropriate column.</Li>
            <Li>To remove a keyword, simply delete the cell contents.</Li>
          </Ul>

          <H3>Keyword rules</H3>
          <Ul>
            <Li>Keywords are matched as <strong className="text-slate-300">whole words</strong>, case-insensitively. "poverty" matches "Poverty" and "POVERTY" but not "impoverishment".</Li>
            <Li>Use a <strong className="text-slate-300">slash to provide variants</strong> in a single cell: <code className="text-blue-300 text-xs">Child labor/labour</code> creates two keywords — "Child labor" and "Child labour". Similarly, <code className="text-blue-300 text-xs">effect/s</code> creates "effect" and "effects".</Li>
            <Li>British and American spellings (e.g. organisation/organization) are <strong className="text-slate-300">expanded automatically</strong> — you only need to enter one form.</Li>
          </Ul>

          <H3>After editing</H3>
          <P>
            Save the file in Excel, then <strong className="text-slate-200">re-run a scrape job</strong> on the pages you want to re-tag. The app reloads the keyword list at the start of each scrape — existing posts already in the database are not automatically re-tagged.
          </P>

          <Warn>
            Do not change the number of columns or move SDG columns around. Column position determines which SDG a keyword belongs to.
          </Warn>

          {/* Interactive file buttons */}
          <div className="mt-4 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg space-y-3">
            <p className="text-xs text-slate-400 font-medium">Your keywords file</p>
            {keywordsPath && (
              <p className="text-[11px] text-slate-600 font-mono break-all">{keywordsPath}</p>
            )}
            {kwError && (
              <p className="text-xs text-red-400">{kwError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-primary text-xs px-3 py-1.5"
                onClick={async () => {
                  setKwError(null)
                  try { await window.api.keywords.openFile() }
                  catch (e) { setKwError(e.message) }
                }}
              >
                ✎ Open in Excel / Spreadsheet
              </button>
              <button
                className="btn-secondary text-xs px-3 py-1.5"
                onClick={() => window.api.keywords.showInFolder()}
              >
                ↗ Show in Finder / Explorer
              </button>
            </div>
          </div>

          <Divider />

          {/* ── Exporting ── */}
          <H2 id="export">Exporting Data</H2>
          <P>
            You can export all collected posts (with their SDG tags) from the <strong className="text-slate-200">Results</strong> page. The export respects whatever filters are currently active — so you can export just the posts for a single SDG, platform, or page.
          </P>

          <H3>Export formats</H3>
          <Ul>
            <Li><strong className="text-slate-300">↓ CSV</strong> — a comma-separated text file. Opens in Excel, Google Sheets, or any spreadsheet app.</Li>
            <Li><strong className="text-slate-300">↓ XLSX</strong> — a native Excel workbook file.</Li>
          </Ul>

          <H3>Exported columns</H3>
          <Ul>
            <Li><code className="text-blue-300 text-xs">id</code> — unique identifier for the post.</Li>
            <Li><code className="text-blue-300 text-xs">platform</code> — wordpress or facebook.</Li>
            <Li><code className="text-blue-300 text-xs">page_id</code> — the source page identifier.</Li>
            <Li><code className="text-blue-300 text-xs">date</code> — publication date.</Li>
            <Li><code className="text-blue-300 text-xs">author</code> — post author where available.</Li>
            <Li><code className="text-blue-300 text-xs">text</code> — full post text.</Li>
            <Li><code className="text-blue-300 text-xs">hashtags</code> — hashtags found in the post.</Li>
            <Li><code className="text-blue-300 text-xs">url</code> — link to the original post.</Li>
            <Li><code className="text-blue-300 text-xs">sdg_numbers</code> — comma-separated list of matched SDG numbers.</Li>
            <Li><code className="text-blue-300 text-xs">confidences</code> — hashtag or keyword for each match.</Li>
            <Li><code className="text-blue-300 text-xs">matched_on</code> — the exact term(s) that triggered each tag.</Li>
          </Ul>

          <Divider />

          {/* ── Tips & Troubleshooting ── */}
          <H2 id="tips">Tips &amp; Troubleshooting</H2>

          <H3>WordPress sites</H3>
          <Ul>
            <Li>Any public WordPress site works without any setup. The app uses the WordPress REST API to fetch posts efficiently.</Li>
            <Li>If a WordPress site returns no posts, it may have disabled its REST API. Try a different URL or contact the site administrator.</Li>
            <Li>The app collects all available posts, not just recent ones. The first scrape of a large blog may take a minute or two.</Li>
          </Ul>

          <H3>Facebook pages</H3>
          <Ul>
            <Li>Facebook requires a saved browser session (login cookies) because it does not have a public API. On first use, the app opens a browser window for you to log in manually. After logging in once, the session is saved and future scrapes run automatically.</Li>
            <Li>Facebook scraping uses randomised delays between actions to behave like a real user. This means large pages take longer.</Li>
            <Li>If Facebook scraping fails with an error about not being logged in, delete the saved session file and log in again.</Li>
          </Ul>

          <H3>Job stuck or showing an error</H3>
          <Ul>
            <Li>Check that the URL in the Pages list is correct and the site is publicly accessible.</Li>
            <Li>Try opening the URL in your regular web browser to confirm it loads.</Li>
            <Li>If the error message mentions "REST API", the WordPress site may have a custom URL structure — try adding <code className="text-blue-300 text-xs">/wp-json/wp/v2/posts</code> to the URL in your browser to test it directly.</Li>
            <Li>Delete the failed job and try again.</Li>
          </Ul>

          <H3>A post was tagged with the wrong SDG</H3>
          <Ul>
            <Li>Keyword matching can occasionally produce false positives — for example, a post about "life" might match SDG 15 (Life on Land) even if it is unrelated.</Li>
            <Li>Hashtag matches (<Badge label="hashtag" color="#3B82F6" />) are more reliable than keyword matches (<Badge label="keyword" color="#475569" />).</Li>
            <Li>You can improve accuracy by editing the keyword file — see the <button onClick={() => scrollTo('keywords')} className="text-blue-400 hover:underline">Editing Keywords</button> section above.</Li>
          </Ul>

          <H3>A post appears more than once</H3>
          <P>
            This should not happen — the app deduplicates posts by their unique ID. If you see what looks like a duplicate, the posts likely came from different scrape jobs or had slightly different IDs assigned by the source platform.
          </P>

          <H3>Data storage</H3>
          <P>
            All data is stored locally on your computer in a SQLite database file. Nothing is sent to any external server. The database file is located in your system's application data folder:
          </P>
          <Ul>
            <Li><strong className="text-slate-300">macOS:</strong> <code className="text-blue-300 text-xs">~/Library/Application Support/sdg-scraper/sdg-scraper.db</code></Li>
            <Li><strong className="text-slate-300">Windows:</strong> <code className="text-blue-300 text-xs">%APPDATA%\sdg-scraper\sdg-scraper.db</code></Li>
          </Ul>

          <Note>
            You can back up your data at any time by copying the <code className="text-blue-300 text-xs">sdg-scraper.db</code> file to a safe location.
          </Note>

        </div>
      </div>

    </div>
  )
}
