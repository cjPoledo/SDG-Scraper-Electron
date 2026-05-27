/**
 * pages/PageManager.jsx
 *
 * Manage target pages (social media pages / websites to scrape).
 * - Add a page: platform + URL + optional label
 * - Remove a page
 * - Lists all saved pages
 */

import { useState, useEffect, useCallback } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function derivePageId(platform, url) {
  try {
    const u = new URL(url)
    if (platform === 'facebook') {
      // e.g. https://facebook.com/somePageName → somePageName
      return u.pathname.replace(/^\/+|\/+$/g, '') || u.hostname
    }
    // wordpress: use hostname + path
    return (u.hostname + u.pathname).replace(/\/+$/, '')
  } catch {
    return url.replace(/[^a-z0-9_-]/gi, '-').slice(0, 64)
  }
}

const PLATFORMS = [
  { value: 'facebook',  label: 'Facebook' },
  { value: 'wordpress', label: 'WordPress' },
]

function PlatformBadge({ platform }) {
  const colors = {
    facebook:  'bg-blue-900/60 text-blue-300 border-blue-700/40',
    wordpress: 'bg-indigo-900/60 text-indigo-300 border-indigo-700/40',
  }
  return (
    <span className={`badge border ${colors[platform] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {platform}
    </span>
  )
}

function EmptyState() {
  return (
    <tr>
      <td colSpan={4} className="text-center py-12 text-slate-500">
        <div className="text-3xl mb-2 opacity-30">⊘</div>
        <div className="text-sm">No pages yet. Add a page above to start scraping.</div>
      </td>
    </tr>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PageManager() {
  const [pages, setPages]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [removing, setRemoving]   = useState(null) // id being removed

  // Form state
  const [platform, setPlatform]   = useState('wordpress')
  const [url, setUrl]             = useState('')
  const [label, setLabel]         = useState('')
  const [adding, setAdding]       = useState(false)
  const [addError, setAddError]   = useState(null)

  // ── Load pages ──────────────────────────────────────────────────────────────

  const loadPages = useCallback(async () => {
    try {
      const data = await window.api.pages.list()
      setPages(data)
      setError(null)
    } catch (e) {
      setError(`Failed to load pages: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPages() }, [loadPages])

  // ── Add page ────────────────────────────────────────────────────────────────

  async function handleAdd(e) {
    e.preventDefault()
    setAddError(null)

    const trimmedUrl = url.trim()
    if (!trimmedUrl) { setAddError('URL is required'); return }

    // Basic URL validation
    try { new URL(trimmedUrl) } catch {
      setAddError('Please enter a valid URL (include https://)'); return
    }

    setAdding(true)
    try {
      await window.api.pages.add({
        platform,
        url: trimmedUrl,
        pageId: derivePageId(platform, trimmedUrl),
        label: label.trim() || null,
      })
      setUrl('')
      setLabel('')
      await loadPages()
    } catch (e) {
      setAddError(e.message)
    } finally {
      setAdding(false)
    }
  }

  // ── Remove page ─────────────────────────────────────────────────────────────

  async function handleRemove(id) {
    if (!window.confirm('Remove this page? Existing posts will be kept.')) return
    setRemoving(id)
    try {
      await window.api.pages.remove(id)
      await loadPages()
    } catch (e) {
      setError(`Failed to remove page: ${e.message}`)
    } finally {
      setRemoving(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-100">Pages</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Add the social media pages or websites you want to scrape.
        </p>
      </div>

      {/* Add form */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-medium text-slate-300 mb-3">Add a page</h2>
        <form onSubmit={handleAdd} noValidate>
          <div className="grid grid-cols-[140px_1fr_180px_auto] gap-3 items-end">
            {/* Platform */}
            <div>
              <label htmlFor="platform" className="block text-xs text-slate-500 mb-1">Platform</label>
              <select
                id="platform"
                className="select"
                value={platform}
                onChange={e => setPlatform(e.target.value)}
              >
                {PLATFORMS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* URL */}
            <div>
              <label htmlFor="page-url" className="block text-xs text-slate-500 mb-1">URL</label>
              <input
                id="page-url"
                type="url"
                className="input"
                placeholder="https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                required
                autoComplete="off"
              />
            </div>

            {/* Label */}
            <div>
              <label htmlFor="page-label" className="block text-xs text-slate-500 mb-1">
                Label <span className="text-slate-600">(optional)</span>
              </label>
              <input
                id="page-label"
                type="text"
                className="input"
                placeholder="My org's blog"
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary"
              disabled={adding}
              aria-busy={adding}
            >
              {adding ? (
                <span className="flex items-center gap-1.5">
                  <Spinner /> Adding…
                </span>
              ) : '+ Add'}
            </button>
          </div>

          {addError && (
            <p className="mt-2 text-xs text-red-400" role="alert">{addError}</p>
          )}
        </form>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-red-900/30 border border-red-700/40 rounded text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      {/* Pages table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-300">
            Saved pages
            {!loading && (
              <span className="ml-2 text-xs text-slate-600 font-normal">({pages.length})</span>
            )}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Saved pages">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className="text-left px-4 py-2 font-medium">Platform</th>
                <th className="text-left px-4 py-2 font-medium">Label / URL</th>
                <th className="text-left px-4 py-2 font-medium">Page ID</th>
                <th className="text-left px-4 py-2 font-medium">Added</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-600">
                    <Spinner className="inline-block" /> Loading…
                  </td>
                </tr>
              ) : pages.length === 0 ? (
                <EmptyState />
              ) : pages.map(page => (
                <tr key={page.id} className="table-row-hover">
                  <td className="px-4 py-2.5">
                    <PlatformBadge platform={page.platform} />
                  </td>
                  <td className="px-4 py-2.5 max-w-xs">
                    {page.label && (
                      <div className="text-slate-200 font-medium truncate">{page.label}</div>
                    )}
                    <div className="text-slate-500 font-mono text-xs truncate">{page.url}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <code className="text-xs text-slate-400 font-mono">{page.page_id}</code>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                    {page.created_at?.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      className="btn btn-danger text-xs px-2 py-1"
                      onClick={() => handleRemove(page.id)}
                      disabled={removing === page.id}
                      aria-label={`Remove ${page.label ?? page.url}`}
                    >
                      {removing === page.id ? <Spinner /> : 'Remove'}
                    </button>
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

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ className = '' }) {
  return (
    <svg
      className={`animate-spin w-3.5 h-3.5 text-slate-400 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
