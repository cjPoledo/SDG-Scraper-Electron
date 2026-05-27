/**
 * pages/JobRunner.jsx
 *
 * Trigger scrape jobs and monitor their progress.
 * - Select a saved page
 * - Start a scrape job
 * - Live progress streamed from the main process updates both the
 *   active-job card AND the job history row in real time
 * - Elapsed timer so the page never feels stuck
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

// ─── Elapsed timer ────────────────────────────────────────────────────────────

function useElapsed(running) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) { setElapsed(0); return }
    setElapsed(0)
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [running])
  return elapsed
}

function fmtElapsed(s) {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// ─── Active job card ──────────────────────────────────────────────────────────

function ActiveJobCard({ job }) {
  const isActive = job.status === 'running' || job.status === 'tagging'
  const isDone   = job.status === 'done'
  const isError  = job.status === 'error'
  const elapsed  = useElapsed(isActive)

  const barColor = isDone ? 'bg-green-500' : isError ? 'bg-red-500' : 'bg-blue-500'

  return (
    <div className={[
      'mt-4 rounded-lg border p-4 transition-colors duration-300',
      isDone  ? 'border-green-700/40 bg-green-900/10' :
      isError ? 'border-red-700/40 bg-red-900/10' :
                'border-blue-700/30 bg-blue-900/10',
    ].join(' ')}>

      {/* Top row: status + elapsed */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isActive && <Spinner className="text-blue-400" />}
          {isDone   && <span className="text-green-400 text-sm">✓</span>}
          {isError  && <span className="text-red-400 text-sm">✗</span>}
          <StatusBadge status={job.status} />
          <span className="text-xs text-slate-500 font-mono">Job #{job.jobId}</span>
        </div>
        {isActive && (
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {fmtElapsed(elapsed)}
          </span>
        )}
      </div>

      {/* Message */}
      <p className={[
        'text-sm mb-3',
        isDone ? 'text-green-300' : isError ? 'text-red-300' : 'text-slate-300',
      ].join(' ')}>
        {job.message ?? 'Working…'}
      </p>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        {isActive ? (
          // Indeterminate sliding bar
          <div className={`h-full ${barColor} rounded-full animate-[slide_1.5s_ease-in-out_infinite]`}
               style={{ width: '40%' }} />
        ) : (
          <div className={`h-full ${barColor} rounded-full transition-all duration-500`}
               style={{ width: '100%' }} />
        )}
      </div>

      {/* Posts counter */}
      {(job.postsFound ?? 0) > 0 && (
        <p className="mt-2 text-xs text-slate-500 tabular-nums">
          {job.postsFound} post{job.postsFound !== 1 ? 's' : ''} processed
        </p>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function JobRunner() {
  const [pages, setPages]               = useState([])
  const [jobs, setJobs]                 = useState([])
  const [selectedPage, setSelectedPage] = useState('')
  const [loading, setLoading]           = useState(true)
  const [starting, setStarting]         = useState(false)
  const [removing, setRemoving]         = useState(null)
  const [error, setError]               = useState(null)
  const [activeJob, setActiveJob]       = useState(null)

  // ── Load data ───────────────────────────────────────────────────────────────

  // Stable ref so the progress handler can call loadJobs without being a dep
  const loadJobsRef = useRef(null)

  const loadJobs = useCallback(async () => {
    try {
      const jobsData = await window.api.jobs.list()
      setJobs(jobsData)
    } catch (e) {
      setError(`Failed to load jobs: ${e.message}`)
    }
  }, [])

  // Keep the ref current whenever loadJobs changes (it's stable, but good practice)
  useEffect(() => { loadJobsRef.current = loadJobs }, [loadJobs])

  const loadData = useCallback(async () => {
    try {
      const [pagesData, jobsData] = await Promise.all([
        window.api.pages.list(),
        window.api.jobs.list(),
      ])
      setPages(pagesData)
      setJobs(jobsData)
      setSelectedPage(prev => {
        if (prev) return prev
        return pagesData.length > 0 ? String(pagesData[0].id) : ''
      })
      setError(null)
    } catch (e) {
      setError(`Failed to load data: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, []) // ← no deps: stable function, uses setState updater form

  // ── Initial data load (once on mount) ──────────────────────────────────────

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Subscribe to progress events (once on mount, never re-subscribes) ──────

  useEffect(() => {
    const unsub = window.api.onJobProgress((data) => {
      // Update the active job card
      setActiveJob(prev => {
        if (!prev || prev.jobId !== data.jobId) return prev
        return { ...prev, ...data }
      })

      // Patch the matching row in the jobs table live so status/posts_found
      // updates without a full reload
      setJobs(prev => prev.map(j =>
        j.id === data.jobId
          ? { ...j,
              status:      data.status ?? j.status,
              posts_found: data.postsFound ?? j.posts_found,
              error:       data.status === 'error' ? data.message : j.error,
            }
          : j
      ))

      // Full reload when job finishes to get final DB values (finished_at etc.)
      if (data.status === 'done' || data.status === 'error') {
        loadJobsRef.current?.()
      }
    })

    return () => { if (typeof unsub === 'function') unsub() }
  }, []) // ← empty deps: subscribe once, use ref for loadJobs

  // ── Start job ───────────────────────────────────────────────────────────────

  async function handleStart(e) {
    e.preventDefault()
    if (!selectedPage) return
    setError(null)
    setStarting(true)

    try {
      const { jobId } = await window.api.jobs.start(Number(selectedPage))
      setActiveJob({ jobId, status: 'running', message: 'Starting…', postsFound: 0 })
      // Reload so the new job row appears in the table immediately
      await loadJobs()
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
      setJobs(prev => prev.filter(j => j.id !== jobId))
      if (activeJob?.jobId === jobId) setActiveJob(null)
    } catch (e) {
      setError(`Failed to remove job: ${e.message}`)
    } finally {
      setRemoving(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasActiveJob = activeJob &&
    (activeJob.status === 'running' || activeJob.status === 'tagging')

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-100">Jobs</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Select a page and start a scrape job. Progress updates live.
        </p>
      </div>

      {/* Start job card */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-medium text-slate-300 mb-3">Start a scrape</h2>

        {pages.length === 0 && !loading ? (
          <p className="text-sm text-slate-500">
            No pages yet.{' '}
            <a href="#/pages" className="text-blue-400 hover:underline">Add a page first.</a>
          </p>
        ) : (
          <form onSubmit={handleStart} noValidate>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label htmlFor="page-select" className="block text-xs text-slate-500 mb-1">
                  Page
                </label>
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
                aria-busy={starting || hasActiveJob}
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

        {/* Active job progress card */}
        {activeJob && <ActiveJobCard job={activeJob} />}

        {error && (
          <p className="mt-3 text-xs text-red-400" role="alert">{error}</p>
        )}
      </div>

      {/* Job history */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-300">
            Recent jobs
            {!loading && (
              <span className="ml-2 text-xs text-slate-600 font-normal">({jobs.length})</span>
            )}
          </h2>
          {hasActiveJob && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <Spinner className="text-blue-400" /> Live
            </span>
          )}
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
              ) : jobs.map(job => {
                const isLive = activeJob?.jobId === job.id &&
                  (job.status === 'running' || job.status === 'tagging')
                return (
                  <tr
                    key={job.id}
                    className={[
                      'table-row-hover transition-colors duration-300',
                      isLive ? 'bg-blue-900/5' : '',
                    ].join(' ')}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500 tabular-nums">
                      #{job.id}
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <div className="text-slate-300 truncate">{job.label ?? job.url ?? '—'}</div>
                      <div className="text-slate-600 text-xs truncate font-mono">{job.platform}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {isLive && <Spinner className="text-blue-400 shrink-0" />}
                        <StatusBadge status={job.status} />
                      </div>
                      {job.error && (
                        <div
                          className="text-xs text-red-400 mt-0.5 truncate max-w-[200px]"
                          title={job.error}
                        >
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
                      {isLive
                        ? <span className="text-blue-400/60 font-mono">running…</span>
                        : (job.finished_at?.replace('T', ' ').slice(0, 16) ?? '—')
                      }
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        className="btn btn-danger text-xs px-2 py-1"
                        onClick={() => handleRemove(job.id)}
                        disabled={removing === job.id || isLive}
                        aria-label={`Remove job #${job.id}`}
                        title={isLive ? 'Cannot delete a running job' : 'Delete job and its posts'}
                      >
                        {removing === job.id ? <Spinner /> : 'Remove'}
                      </button>
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
