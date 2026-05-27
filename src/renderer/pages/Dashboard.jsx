/**
 * pages/Dashboard.jsx
 *
 * Aggregated metrics and charts for all scraped + tagged posts.
 * Uses pure CSS bar charts and SVG sparklines — no external chart library.
 *
 * Sections:
 *   1. KPI cards  — totals at a glance
 *   2. SDG distribution bar chart — posts per SDG (1–17)
 *   3. Posts over time — monthly sparkline/bar chart
 *   4. Top matched keywords/hashtags table
 *   5. Coverage by page table
 *   6. Confidence breakdown
 *   7. Recent jobs summary
 */

import { useState, useEffect, useCallback } from 'react'

// ─── SDG colours (official UN palette) ───────────────────────────────────────

const SDG_COLORS = {
  1:'#E5243B', 2:'#DDA63A', 3:'#4C9F38', 4:'#C5192D', 5:'#FF3A21',
  6:'#26BDE2', 7:'#FCC30B', 8:'#A21942', 9:'#FD6925', 10:'#DD1367',
  11:'#FD9D24', 12:'#BF8B2E', 13:'#3F7E44', 14:'#0A97D9', 15:'#56C02B',
  16:'#00689D', 17:'#19486A',
}

const SDG_NAMES = {
  1:'No Poverty', 2:'Zero Hunger', 3:'Good Health', 4:'Quality Education',
  5:'Gender Equality', 6:'Clean Water', 7:'Clean Energy', 8:'Decent Work',
  9:'Innovation', 10:'Reduced Inequalities', 11:'Sustainable Cities',
  12:'Responsible Consumption', 13:'Climate Action', 14:'Life Below Water',
  15:'Life on Land', 16:'Peace & Justice', 17:'Partnerships',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent = 'text-slate-100' }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${accent}`}>
        {value ?? <span className="text-slate-700">—</span>}
      </div>
      {sub && <div className="text-xs text-slate-600">{sub}</div>}
    </div>
  )
}

// ─── Horizontal bar chart (SDG distribution) ─────────────────────────────────

function SdgBarChart({ data }) {
  const max = Math.max(...data.map(d => d.post_count), 1)
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 17 }, (_, i) => i + 1).map(n => {
        const row = data.find(d => d.sdg_number === n)
        const count = row?.post_count ?? 0
        const pct = (count / max) * 100
        return (
          <div key={n} className="flex items-center gap-2 group">
            {/* SDG number badge */}
            <span
              className="inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-bold text-white shrink-0"
              style={{ backgroundColor: SDG_COLORS[n] }}
              title={SDG_NAMES[n]}
            >
              {n}
            </span>
            {/* Bar */}
            <div className="flex-1 h-4 bg-slate-800 rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: SDG_COLORS[n],
                  opacity: count === 0 ? 0 : 0.85,
                  minWidth: count > 0 ? '2px' : 0,
                }}
              />
            </div>
            {/* Count */}
            <span className="text-xs text-slate-500 tabular-nums w-8 text-right shrink-0">
              {count > 0 ? count : <span className="text-slate-700">0</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Monthly bar chart ────────────────────────────────────────────────────────

function MonthlyChart({ data }) {
  if (!data.length) return <Empty message="No date data available." />
  const max = Math.max(...data.map(d => d.post_count), 1)

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1.5 min-w-max pb-1" style={{ minHeight: '7rem' }}>
        {data.map(({ month, post_count }) => {
          const pct = (post_count / max) * 100
          const label = month ?? '?'
          // Shorten label: "2025-03" → "Mar '25"
          const [yr, mo] = label.split('-')
          const MON = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
          const shortLabel = mo ? `${MON[+mo]} '${yr?.slice(2)}` : label

          return (
            <div
              key={month}
              className="flex flex-col items-center gap-1 group w-10 shrink-0"
              title={`${label}: ${post_count} post${post_count !== 1 ? 's' : ''}`}
            >
              {/* Hover count */}
              <span className="text-[10px] text-blue-400 tabular-nums font-mono opacity-0 group-hover:opacity-100 transition-opacity h-4">
                {post_count}
              </span>
              {/* Bar */}
              <div className="w-full flex items-end" style={{ height: '80px' }}>
                <div
                  className="w-full bg-blue-500/70 hover:bg-blue-400/80 rounded-t-sm transition-all duration-300 cursor-default"
                  style={{ height: `${Math.max(pct, post_count > 0 ? 3 : 0)}%` }}
                />
              </div>
              {/* Label */}
              <span className="text-[10px] text-slate-500 font-mono text-center leading-tight whitespace-nowrap">
                {shortLabel}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Confidence donut (pure CSS) ──────────────────────────────────────────────

function ConfidenceBar({ data }) {
  if (!data.length) return <Empty />
  const total = data.reduce((s, d) => s + d.count, 0)
  const CONF_COLORS = {
    hashtag: '#3B82F6',
    keyword: '#64748B',
    ai:      '#A855F7',
  }
  return (
    <div className="space-y-2.5">
      {data.map(({ confidence, count }) => {
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0
        return (
          <div key={confidence} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: CONF_COLORS[confidence] ?? '#64748B' }}
            />
            <span className="text-xs text-slate-400 w-16 capitalize">{confidence}</span>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: CONF_COLORS[confidence] ?? '#64748B' }}
              />
            </div>
            <span className="text-xs text-slate-500 tabular-nums w-16 text-right">
              {count.toLocaleString()} <span className="text-slate-600">({pct}%)</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Empty({ message = 'No data yet.' }) {
  return <p className="text-sm text-slate-600 py-4 text-center">{message}</p>
}

function SectionHeader({ title, sub }) {
  return (
    <div className="px-4 py-3 border-b border-slate-800">
      <h2 className="text-sm font-medium text-slate-300">{title}</h2>
      {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

const STATUS_COLORS = {
  pending: 'text-slate-400', running: 'text-blue-400',
  tagging: 'text-amber-400', done: 'text-green-400', error: 'text-red-400',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats, setStats]     = useState(null)
  const [pages, setPages]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // Filters
  const [platform, setPlatform] = useState('')
  const [pageId, setPageId]     = useState('')

  // ── Load pages for filter dropdown ─────────────────────────────────────────

  useEffect(() => {
    window.api.pages.list().then(setPages).catch(() => {})
  }, [])

  // ── Load stats ──────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setLoading(true)
    setStats(null)
    try {
      const data = await window.api.dashboard.stats({
        ...(platform ? { platform } : {}),
        ...(pageId   ? { pageId }   : {}),
      })
      setStats(data)
      setError(null)
    } catch (e) {
      setError(`Failed to load stats: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [platform, pageId])

  useEffect(() => { loadStats() }, [loadStats])

  // ── Derived values ──────────────────────────────────────────────────────────

  const tagRate = stats
    ? stats.totals.total_posts > 0
      ? ((stats.totals.tagged_posts / stats.totals.total_posts) * 100).toFixed(1)
      : '0'
    : null

  const topSDG = stats?.bySDG?.length
    ? stats.bySDG.reduce((a, b) => (b.post_count > a.post_count ? b : a))
    : null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">

      {/* Header + filters */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Aggregated metrics across all scraped posts.</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            className="select text-xs py-1 w-40"
            value={platform}
            onChange={e => { setPlatform(e.target.value); setPageId('') }}
            aria-label="Filter by platform"
          >
            <option value="">All platforms</option>
            <option value="facebook">Facebook</option>
            <option value="wordpress">WordPress</option>
          </select>

          <select
            className="select text-xs py-1 w-52"
            value={pageId}
            onChange={e => setPageId(e.target.value)}
            aria-label="Filter by page"
          >
            <option value="">All pages</option>
            {pages
              .filter(p => !platform || p.platform === platform)
              .map(p => (
                <option key={p.id} value={p.page_id}>
                  {p.label ?? p.url}
                </option>
              ))
            }
          </select>

          <button
            className="btn-secondary text-xs px-3 py-1"
            onClick={loadStats}
            disabled={loading}
            aria-label="Refresh"
          >
            {loading ? <Spinner /> : '↺ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-900/30 border border-red-700/40 rounded text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total posts"
          value={loading ? '…' : stats?.totals.total_posts.toLocaleString()}
          accent="text-slate-100"
        />
        <KpiCard
          label="Tagged posts"
          value={loading ? '…' : stats?.totals.tagged_posts.toLocaleString()}
          sub={tagRate != null ? `${tagRate}% coverage` : undefined}
          accent="text-blue-300"
        />
        <KpiCard
          label="Total tags"
          value={loading ? '…' : stats?.totals.total_tags.toLocaleString()}
          sub="across all SDGs"
          accent="text-slate-100"
        />
        <KpiCard
          label="Top SDG"
          value={loading ? '…' : topSDG ? `SDG ${topSDG.sdg_number}` : '—'}
          sub={topSDG ? `${topSDG.post_count} posts · ${SDG_NAMES[topSDG.sdg_number]}` : undefined}
          accent="text-amber-300"
        />
      </div>

      {/* ── SDG distribution + confidence ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* SDG bar chart */}
        <div className="card overflow-hidden lg:col-span-2">
          <SectionHeader
            title="Posts by SDG"
            sub="How many tagged posts match each goal"
          />
          <div className="p-4">
            {loading
              ? <div className="text-center py-8 text-slate-600"><Spinner className="inline-block" /> Loading…</div>
              : <SdgBarChart data={stats?.bySDG ?? []} />
            }
          </div>
        </div>

        {/* Confidence + platform breakdown */}
        <div className="flex flex-col gap-4">
          <div className="card overflow-hidden">
            <SectionHeader title="Match confidence" sub="Hashtag vs keyword" />
            <div className="p-4">
              {loading
                ? <Empty message="Loading…" />
                : <ConfidenceBar data={stats?.byConfidence ?? []} />
              }
            </div>
          </div>

          <div className="card overflow-hidden">
            <SectionHeader title="Posts by platform" />
            <div className="p-4 space-y-2">
              {loading ? <Empty message="Loading…" /> :
               !stats?.byPlatform?.length ? <Empty /> :
               stats.byPlatform.map(({ platform: plat, post_count }) => {
                 const max = Math.max(...stats.byPlatform.map(p => p.post_count), 1)
                 const pct = (post_count / max) * 100
                 const color = plat === 'facebook' ? '#3B82F6' : '#818CF8'
                 return (
                   <div key={plat} className="flex items-center gap-2">
                     <span className="text-xs text-slate-400 w-20 capitalize">{plat}</span>
                     <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: color }} />
                     </div>
                     <span className="text-xs text-slate-500 tabular-nums w-10 text-right">
                       {post_count.toLocaleString()}
                     </span>
                   </div>
                 )
               })
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── Posts over time ── */}
      <div className="card overflow-hidden">
        <SectionHeader title="Posts over time" sub="Monthly post count" />
        <div className="p-4 pb-6">
          {loading
            ? <div className="text-center py-8 text-slate-600"><Spinner className="inline-block" /> Loading…</div>
            : !stats?.byMonth?.length
              ? <Empty message="No date data available." />
              : <MonthlyChart data={stats.byMonth} />
          }
        </div>
      </div>

      {/* ── Coverage by page + top keywords ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Coverage by page */}
        <div className="card overflow-hidden">
          <SectionHeader title="Coverage by page" sub="Posts scraped per page" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Posts by page">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-800">
                  <th className="text-left px-4 py-2 font-medium">Page</th>
                  <th className="text-left px-4 py-2 font-medium">Platform</th>
                  <th className="text-right px-4 py-2 font-medium">Posts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr><td colSpan={3} className="text-center py-8 text-slate-600"><Spinner className="inline-block" /> Loading…</td></tr>
                ) : !stats?.byPage?.length ? (
                  <tr><td colSpan={3} className="text-center py-8 text-slate-500 text-sm">No data yet.</td></tr>
                ) : stats.byPage.map(row => (
                  <tr key={row.page_id} className="table-row-hover">
                    <td className="px-4 py-2.5 max-w-[180px]">
                      <div className="text-slate-300 text-xs truncate">
                        {row.label ?? row.url ?? row.page_id}
                      </div>
                      <div className="text-slate-600 text-[11px] font-mono truncate">{row.page_id}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-slate-500 capitalize">{row.platform ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-300 text-sm font-medium">
                      {row.post_count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top keywords */}
        <div className="card overflow-hidden">
          <SectionHeader title="Top matched terms" sub="Most frequent keywords and hashtags" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Top matched terms">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-800">
                  <th className="text-left px-4 py-2 font-medium">Term</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-left px-4 py-2 font-medium">SDG</th>
                  <th className="text-right px-4 py-2 font-medium">Matches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-600"><Spinner className="inline-block" /> Loading…</td></tr>
                ) : !stats?.topKeywords?.length ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-500 text-sm">No data yet.</td></tr>
                ) : stats.topKeywords.map((row, i) => (
                  <tr key={i} className="table-row-hover">
                    <td className="px-4 py-2 font-mono text-xs text-slate-300 max-w-[160px] truncate" title={row.matched_on}>
                      {row.matched_on}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`badge border text-[10px] ${
                        row.confidence === 'hashtag'
                          ? 'bg-blue-900/50 text-blue-300 border-blue-700/40'
                          : 'bg-slate-700 text-slate-400 border-slate-600'
                      }`}>
                        {row.confidence}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: SDG_COLORS[row.sdg_number] ?? '#3B82F6' }}
                        title={`SDG ${row.sdg_number} — ${SDG_NAMES[row.sdg_number]}`}
                      >
                        {row.sdg_number}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-300 text-sm font-medium">
                      {row.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Recent jobs ── */}
      <div className="card overflow-hidden">
        <SectionHeader title="Recent jobs" sub="Last 5 scrape runs" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Recent jobs">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className="text-left px-4 py-2 font-medium">ID</th>
                <th className="text-left px-4 py-2 font-medium">Page</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Posts</th>
                <th className="text-left px-4 py-2 font-medium">Started</th>
                <th className="text-left px-4 py-2 font-medium">Finished</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-600"><Spinner className="inline-block" /> Loading…</td></tr>
              ) : !stats?.recentJobs?.length ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500 text-sm">No jobs yet.</td></tr>
              ) : stats.recentJobs.map(job => (
                <tr key={job.id} className="table-row-hover">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">#{job.id}</td>
                  <td className="px-4 py-2.5 max-w-[180px]">
                    <div className="text-slate-300 text-xs truncate">{job.label ?? job.url ?? '—'}</div>
                    <div className="text-slate-600 text-[11px] font-mono">{job.platform}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium ${STATUS_COLORS[job.status] ?? 'text-slate-400'}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">
                    {job.posts_found ?? 0}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                    {job.started_at?.replace('T', ' ').slice(0, 16) ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                    {job.finished_at?.replace('T', ' ').slice(0, 16) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

function Spinner({ className = '' }) {
  return (
    <svg className={`animate-spin w-3.5 h-3.5 text-slate-400 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
