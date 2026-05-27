/**
 * pages/Results.jsx
 *
 * Browse, filter, and export SDG-tagged posts.
 * - Filter by SDG number (1–17) via pill buttons
 * - Filter by platform
 * - Paginated results table
 * - Export to CSV or XLSX via the xlsx package
 */

import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'

// ─── SDG color mapping (17 goals) ────────────────────────────────────────────
// Official UN SDG colours (approximate hex)
const SDG_COLORS = {
  1:  '#E5243B', 2:  '#DDA63A', 3:  '#4C9F38', 4:  '#C5192D',
  5:  '#FF3A21', 6:  '#26BDE2', 7:  '#FCC30B', 8:  '#A21942',
  9:  '#FD6925', 10: '#DD1367', 11: '#FD9D24', 12: '#BF8B2E',
  13: '#3F7E44', 14: '#0A97D9', 15: '#56C02B', 16: '#00689D',
  17: '#19486A',
}

function SdgPill({ number, active, onClick }) {
  const color = SDG_COLORS[number] ?? '#3B82F6'
  return (
    <button
      onClick={() => onClick(number)}
      aria-pressed={active}
      title={`SDG ${number}`}
      className={[
        'inline-flex items-center justify-center w-8 h-8 rounded text-xs font-bold',
        'transition-all duration-150 cursor-pointer border',
        active
          ? 'text-white border-transparent shadow-lg scale-105'
          : 'text-slate-400 bg-slate-800 border-slate-700 hover:border-slate-500 hover:text-slate-200',
      ].join(' ')}
      style={active ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {number}
    </button>
  )
}

function ConfidenceBadge({ confidence }) {
  const styles = {
    hashtag: 'bg-blue-900/50 text-blue-300 border-blue-700/40',
    keyword: 'bg-slate-700 text-slate-400 border-slate-600',
    ai:      'bg-purple-900/50 text-purple-300 border-purple-700/40',
  }
  return (
    <span className={`badge border ${styles[confidence] ?? styles.keyword}`}>
      {confidence}
    </span>
  )
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportToCsv(rows, filename) {
  const ws  = XLSX.utils.json_to_sheet(rows)
  const wb  = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Posts')
  XLSX.writeFile(wb, filename, { bookType: 'csv' })
}

function exportToXlsx(rows, filename) {
  const ws  = XLSX.utils.json_to_sheet(rows)
  const wb  = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Posts')
  XLSX.writeFile(wb, filename)
}

function flattenForExport(post) {
  return {
    id:          post.id,
    platform:    post.platform,
    page_id:     post.page_id,
    date:        post.date,
    author:      post.author,
    text:        post.text,
    hashtags:    post.hashtags,
    url:         post.url,
    sdg_numbers: post.sdg_numbers ?? post.sdg_number ?? '',
    confidences: post.confidences ?? post.confidence ?? '',
    matched_on:  post.matched_on ?? '',
  }
}

const PAGE_SIZE = 50

// ─── Component ────────────────────────────────────────────────────────────────

export default function Results() {
  const [posts, setPosts]         = useState([])
  const [pages, setPages]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError]         = useState(null)

  // Filters
  const [activeSdg, setActiveSdg]     = useState(null) // number or null
  const [platform, setPlatform]       = useState('')
  const [pageId, setPageId]           = useState('')
  const [offset, setOffset]           = useState(0)

  // ── Load pages list (for filter dropdown) ──────────────────────────────────

  useEffect(() => {
    window.api.pages.list()
      .then(setPages)
      .catch(() => {}) // non-fatal
  }, [])

  // ── Load posts ──────────────────────────────────────────────────────────────

  const loadPosts = useCallback(async () => {
    setLoading(true)
    setPosts([])
    try {
      const filters = {
        limit:  PAGE_SIZE,
        offset,
        ...(activeSdg ? { sdgNumber: activeSdg } : {}),
        ...(platform  ? { platform }             : {}),
        ...(pageId    ? { pageId }               : {}),
      }
      const data = await window.api.posts.query(filters)
      setPosts(data)
      setError(null)
    } catch (e) {
      setError(`Failed to load posts: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [activeSdg, platform, pageId, offset])

  useEffect(() => { loadPosts() }, [loadPosts])

  // Reset to page 1 when filters change
  useEffect(() => { setOffset(0) }, [activeSdg, platform, pageId])

  // ── SDG filter toggle ───────────────────────────────────────────────────────

  function toggleSdg(n) {
    setActiveSdg(prev => prev === n ? null : n)
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  async function handleExport(format) {
    setExporting(true)
    try {
      const filters = {
        ...(activeSdg ? { sdgNumber: activeSdg } : {}),
        ...(platform  ? { platform }             : {}),
        ...(pageId    ? { pageId }               : {}),
      }
      const data = await window.api.posts.export(filters)
      const rows = data.map(flattenForExport)
      const ts   = new Date().toISOString().slice(0, 10)
      const name = `sdg-posts-${ts}`

      if (format === 'csv') exportToCsv(rows,  `${name}.csv`)
      else                   exportToXlsx(rows, `${name}.xlsx`)
    } catch (e) {
      setError(`Export failed: ${e.message}`)
    } finally {
      setExporting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const sdgNumbers = Array.from({ length: 17 }, (_, i) => i + 1)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Results</h1>
          <p className="text-sm text-slate-500 mt-0.5">Browse and export SDG-tagged posts.</p>
        </div>

        {/* Export buttons */}
        <div className="flex gap-2">
          <button
            className="btn-secondary text-xs"
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
          >
            {exporting ? <Spinner /> : '↓ CSV'}
          </button>
          <button
            className="btn-secondary text-xs"
            onClick={() => handleExport('xlsx')}
            disabled={exporting || loading}
          >
            {exporting ? <Spinner /> : '↓ XLSX'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 space-y-3">
        {/* SDG filter pills */}
        <div>
          <div className="text-xs text-slate-500 mb-2">Filter by SDG</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveSdg(null)}
              aria-pressed={activeSdg === null}
              className={[
                'btn text-xs px-2.5 py-1 border',
                activeSdg === null
                  ? 'bg-slate-600 text-slate-100 border-slate-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200',
              ].join(' ')}
            >
              All
            </button>
            {sdgNumbers.map(n => (
              <SdgPill key={n} number={n} active={activeSdg === n} onClick={toggleSdg} />
            ))}
          </div>
        </div>

        {/* Platform + page filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500">Platform</div>
            <select
              className="select w-40 text-xs py-1"
              value={platform}
              onChange={e => { setPlatform(e.target.value); setPageId('') }}
              aria-label="Filter by platform"
            >
              <option value="">All platforms</option>
              <option value="facebook">Facebook</option>
              <option value="wordpress">WordPress</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500">Page</div>
            <select
              className="select w-56 text-xs py-1"
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
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-red-900/30 border border-red-700/40 rounded text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      {/* Posts table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-300">
            Posts
            {!loading && (
              <span className="ml-2 text-xs text-slate-600 font-normal">
                {posts.length < PAGE_SIZE ? posts.length : `${PAGE_SIZE}+`} shown
              </span>
            )}
          </h2>

          {/* Pagination controls */}
          <div className="flex items-center gap-2 text-xs">
            <button
              className="btn-secondary px-2 py-1 text-xs disabled:opacity-30"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || loading}
            >
              ← Prev
            </button>
            <span className="text-slate-500 tabular-nums">
              {offset + 1}–{offset + posts.length}
            </span>
            <button
              className="btn-secondary px-2 py-1 text-xs disabled:opacity-30"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={posts.length < PAGE_SIZE || loading}
            >
              Next →
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Tagged posts">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Platform</th>
                <th className="text-left px-4 py-2 font-medium">Text preview</th>
                <th className="text-left px-4 py-2 font-medium">SDGs</th>
                <th className="text-left px-4 py-2 font-medium">Confidence</th>
                <th className="text-left px-4 py-2 font-medium">Matched on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-600">
                    <Spinner className="inline-block" /> Loading…
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500 text-sm">
                    No posts found.
                    {activeSdg != null && (
                      <> Try removing the SDG filter or <button className="text-blue-400 hover:underline ml-1 cursor-pointer" onClick={() => setActiveSdg(null)}>show all</button>.</>
                    )}
                  </td>
                </tr>
              ) : posts.map(post => {
                const sdgs = post.sdg_numbers
                  ? String(post.sdg_numbers).split(',').map(Number).filter(Boolean)
                  : post.sdg_number ? [post.sdg_number] : []

                return (
                  <tr key={post.id} className="table-row-hover align-top">
                    <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {post.date?.slice(0, 10) ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-slate-400">{post.platform}</span>
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <p className="text-slate-300 text-xs line-clamp-2 leading-relaxed">
                        {post.text || <span className="text-slate-600 italic">No text</span>}
                      </p>
                      {post.url && (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-500 hover:underline font-mono truncate block max-w-[200px] mt-0.5"
                        >
                          {post.url}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {sdgs.length > 0 ? sdgs.map(n => (
                          <span
                            key={n}
                            className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold text-white"
                            style={{ backgroundColor: SDG_COLORS[n] ?? '#3B82F6' }}
                            title={`SDG ${n}`}
                          >
                            {n}
                          </span>
                        )) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {post.confidence
                        ? <ConfidenceBadge confidence={post.confidence} />
                        : post.confidences
                          ? String(post.confidences).split(',').map((c, i) => (
                              <ConfidenceBadge key={i} confidence={c.trim()} />
                            ))
                          : <span className="text-slate-600 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[160px]">
                      {post.matched_on
                        ? String(post.matched_on).split(',').map((m, i) => (
                            <span key={i} className="block truncate font-mono leading-snug" title={m.trim()}>
                              {m.trim()}
                            </span>
                          ))
                        : <span className="text-slate-600">—</span>
                      }
                    </td>
                  </tr>
                )
              })}
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
