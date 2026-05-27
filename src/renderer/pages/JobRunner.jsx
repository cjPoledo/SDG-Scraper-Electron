/**
 * pages/JobRunner.jsx
 *
 * Trigger scrape jobs and monitor their progress.
 * - Select a saved page
 * - Start a scrape job
 * - See live progress streamed from the main process
 * - Review recent job history
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  pending: 'bg-slate-700 text-slate-300 border-slate-600',
  running: 'bg-blue-900/60 text-blue-300 border-blue-700/40',
  tagging: 'bg-amber-900/60 text-amber-300 border-amber-700/40',
  done:    'bg-green-900/60 text-green-300 border-green-700/40',
  error:   'bg-red-900/60 text-red-300 border-red-700/40',
}

function StatusBadge({ status }) {
  return (
    <span className={`badge border ${STATUS_COLORS[status] ?? STATUS_COLORS.pending}`}>
      {status}
    </span>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ status, message, postsFound }) {
  const isActive = status === 'running' || status === 'tagging'
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>{message ?? 'Waiting…'}</span>
        {postsFound > 0 && <span className="tabular-nums">{postsFound} posts</span>}
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        {isActive ? (
          <div
            className="h-full bg-blue-500 rounded-full animate-pulse"
            style={{ width: '60%' }}
          />
        ) : status === 'done' ? (
          <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
        ) : status === 'error' ? (
          <div className="h-full bg-red-500 rounded-full" style={{ width: '100%' }} />
        ) : null}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function JobRunner() {
  const [pages, setPages]         = useState([])
  const [jobs, setJobs]           = useState([])
  const [selectedPage, setSelectedPage] = useState('')
  const [loading, setLoading]     = useState(true)
  const [starting, setStarting]   = useState(false)
  const [removing, setRemoving]   = useState(null) // jobId being removed
  const [error, setError]         = useState(null)
  const [activeJob, setActiveJob] = useState(null) // { jobId, status, message, postsFound }

  // Cleanup ref for the progress listener unsubscribe function
  const unsubRef = useRef(null)

  // ── Load data ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [pagesData, jobsData] = await Promise.all([
        window.api.pages.list(),
        window.api.jobs.list(),
      ])
      setPages(pagesData)
      setJobs(jobsData)
      if (pagesData.length > 0 && !selectedPage) {
        setSelectedPage(String(pagesData[0].id))
      }
      setError(null)
    } catch (e) {
      setError(`Failed to load data: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [selectedPage])

  useEffect(() => {
    loadData()

    // Subscribe to job progress push events from main process
    const unsub = window.api.onJobProgress((data) => {
      setActiveJob(prev => {
        if (!prev || prev.jobId !== data.jobId) return prev
        return { ...prev, ...data }
      })

      // Refresh job list when a job finishes
      if (data.status === 'done' || data.status === 'error') {
        loadData()
      }
    })

    unsubRef.current = unsub
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [loadData])

  // ── Start job ───────────────────────────────────────────────────────────────

  async function handleStart(e) {
    e.preventDefault()
    if (!selectedPage) return
    setError(null)
    setStarting(true)

    try {
      const { jobId } = await window.api.jobs.start(Number(selectedPage))
      setActiveJob({ jobId, status: 'running', message: 'Starting…', postsFound: 0 })
      await loadData()
    } catch (e) {
      setError(`Failed to start job: ${e.message}`)
    } finally {
      setStarting(false)
    }
  }

  // ── Remove job ──────────────────────────────────────────────────────────────

  async function handleRemove(jobId) {
    if (!window.confirm('Delete this job and all posts scraped in this run?')) return
    setRemoving(jobId)
    setError(null)
    try {
      await window.api.jobs.remove(jobId)
      await loadData()
    } catch (e) {
      setError(`Failed to remove job: ${e.message}`)
    } finally {
      setRemoving(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasActiveJob = activeJob && (activeJob.status === 'running' || activeJob.status === 'tagging')

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-100">Jobs</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Select a page and start a scrape job. Progress streams in real time.
        </p>
      </div>

      {/* Start job form */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-medium text-slate-300 mb-3">Start a scrape</h2>

        {pages.length === 0 && !loading ? (
          <p className="text-sm text-slate-500">
            No pages yet. <a href="#/pages" className="text-blue-400 hover:underline">Add a page first.</a>
          </p>
        ) : (
          <form onSubmit={handleStart} noValidate>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label htmlFor="page-select" className="block text-xs text-slate-500 mb-1">Page</label>
                <select
                  id="page-select"
                  className="select"
                  value={selectedPage}
                  onChange={e => setSelectedPage(e.target.value)}
                  disabled={hasActiveJob || loading}
                >
                  {pages.map(p => (
                    <option key={p.id} value={String(p.id)}>
                      {p.label ?? p.url} ({p.platform})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={starting || hasActiveJob || loading || !selectedPage}
                aria-busy={starting}
              >
                {starting ? (
                  <span className="flex items-center gap-1.5"><Spinner /> Starting…</span>
                ) : hasActiveJob ? (
                  <span className="flex items-center gap-1.5"><Spinner /> Running…</span>
                ) : '▶ Start Scrape'}
              </button>
            </div>
          </form>
        )}

        {/* Active job progress */}
        {activeJob && (
          <ProgressBar
            status={activeJob.status}
            message={activeJob.message}
            postsFound={activeJob.postsFound}
          />
        )}

        {error && (
          <p className="mt-2 text-xs text-red-400" role="alert">{error}</p>
        )}
      </div>

      {/* Job history */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h2 className="text-sm font-medium text-slate-300">
            Recent jobs
            {!loading && <span className="ml-2 text-xs text-slate-600 font-normal">({jobs.length})</span>}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Recent scrape jobs">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className="text-left px-4 py-2 font-medium">ID</th>
                <th className="text-left px-4 py-2 font-medium">Page</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Posts</th>
                <th className="text-left px-4 py-2 font-medium">Started</th>
                <th className="text-left px-4 py-2 font-medium">Finished</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-600">
                    <Spinner className="inline-block" /> Loading…
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500 text-sm">
                    No jobs yet.
                  </td>
                </tr>
              ) : jobs.map(job => (
                <tr key={job.id} className="table-row-hover">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500 tabular-nums">
                    #{job.id}
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <div className="text-slate-300 truncate">{job.label ?? job.url ?? '—'}</div>
                    <div className="text-slate-600 text-xs truncate font-mono">{job.platform}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={job.status} />
                    {job.error && (
                      <div className="text-xs text-red-400 mt-0.5 truncate max-w-[180px]" title={job.error}>
                        {job.error}
                      </div>
                    )}
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
                  <td className="px-4 py-2.5 text-right">
                    <button
                      className="btn btn-danger text-xs px-2 py-1"
                      onClick={() => handleRemove(job.id)}
                      disabled={removing === job.id || job.status === 'running'}
                      aria-label={`Remove job #${job.id}`}
                      title={job.status === 'running' ? 'Cannot delete a running job' : 'Delete job and its posts'}
                    >
                      {removing === job.id ? <Spinner /> : 'Remove'}
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

function Spinner({ className = '' }) {
  return (
    <svg className={`animate-spin w-3.5 h-3.5 text-slate-400 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
