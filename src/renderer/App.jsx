/**
 * App.jsx — Root React component
 *
 * Provides the app shell: persistent sidebar nav + content area.
 * Uses React Router v6 HashRouter (safe for Electron file:// URLs).
 */

import { HashRouter, NavLink, Routes, Route, Navigate } from 'react-router-dom'
import sdgIcon from './assets/icon.png'
import Dashboard   from './pages/Dashboard.jsx'
import PageManager from './pages/PageManager.jsx'
import JobRunner   from './pages/JobRunner.jsx'
import Results     from './pages/Results.jsx'
import Help        from './pages/Help.jsx'

// ─── SVG Icons (inline, no dependency) ────────────────────────────────────────

function IconPages({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  )
}

function IconJobs({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function IconResults({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  )
}

function IconDashboard({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}

function IconHelp({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconSDG({ className = 'w-5 h-5' }) {
  return (
    <img
      src={sdgIcon}
      alt="SDG Scraper"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard, title: 'Metrics and charts' },
  { to: '/pages',     label: 'Pages',     Icon: IconPages,     title: 'Manage target pages' },
  { to: '/jobs',      label: 'Jobs',      Icon: IconJobs,      title: 'Run scrape jobs' },
  { to: '/results',   label: 'Results',   Icon: IconResults,   title: 'Browse tagged posts' },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  return (
    <nav
      className="flex flex-col w-48 shrink-0 bg-slate-900 border-r border-slate-800 h-screen"
      aria-label="Main navigation"
    >
      {/* Logo / brand */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-800">
        <IconSDG className="w-6 h-6 text-blue-500" />
        <div>
          <div className="text-sm font-semibold text-slate-100 leading-none">SDG Scraper</div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">v0.1.0</div>
        </div>
      </div>

      {/* Nav links */}
      <ul className="flex flex-col gap-0.5 p-2 flex-1" role="list">
        {NAV_ITEMS.map(({ to, label, Icon, title }) => (
          <li key={to}>
            <NavLink
              to={to}
              title={title}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors duration-150 cursor-pointer',
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Help link */}
      <div className="px-2 py-3 border-t border-slate-800">
        <NavLink
          to="/help"
          title="User manual"
          className={({ isActive }) =>
            [
              'flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors duration-150 cursor-pointer',
              isActive
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent',
            ].join(' ')
          }
        >
          <IconHelp className="w-4 h-4 shrink-0" />
          Help
        </NavLink>
      </div>
    </nav>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <HashRouter>
      <div className="flex h-screen overflow-hidden bg-gray-950 text-slate-200">
        <Sidebar />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto" id="main-content" tabIndex={-1}>
          <Routes>
            <Route path="/"          element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pages"     element={<PageManager />} />
            <Route path="/jobs"      element={<JobRunner />} />
            <Route path="/results"   element={<Results />} />
            <Route path="/help"      element={<Help />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
