/**
 * preload.js — IPC bridge
 *
 * Runs in a special context that has access to both Node.js (limited) and the
 * browser DOM. We use contextBridge.exposeInMainWorld() to selectively expose
 * typed functions to the renderer process under window.api.
 *
 * Security rules:
 *   - Never expose ipcRenderer directly
 *   - Never expose require() or any Node module directly
 *   - Validate / sanitise args here before forwarding to main process
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // ── Pages ────────────────────────────────────────────────────────────────
  pages: {
    /** @returns {Promise<Page[]>} */
    list: () => ipcRenderer.invoke('pages:list'),

    /**
     * @param {{ platform: string, url: string, pageId: string, label?: string }} page
     * @returns {Promise<{ id: number }>}
     */
    add: (page) => ipcRenderer.invoke('pages:add', page),

    /**
     * @param {number} id
     * @returns {Promise<void>}
     */
    remove: (id) => ipcRenderer.invoke('pages:remove', id),
  },

  // ── Scrape jobs ──────────────────────────────────────────────────────────
  jobs: {
    /**
     * Start a scrape job for the given page.
     * @param {number} pageId
     * @returns {Promise<{ jobId: number }>}
     */
    start: (pageId) => ipcRenderer.invoke('jobs:start', pageId),

    /**
     * @param {number} jobId
     * @returns {Promise<Job>}
     */
    getStatus: (jobId) => ipcRenderer.invoke('jobs:getStatus', jobId),

    /** @returns {Promise<Job[]>} */
    list: () => ipcRenderer.invoke('jobs:list'),

    /**
     * Delete a job and its associated posts/tags.
     * @param {number} jobId
     * @returns {Promise<void>}
     */
    remove: (jobId) => ipcRenderer.invoke('jobs:remove', jobId),
  },

  // ── Posts & SDG tags ─────────────────────────────────────────────────────
  posts: {
    /**
     * Query posts with optional filters.
     * @param {{ sdgNumber?: number, platform?: string, pageId?: string, limit?: number, offset?: number }} filters
     * @returns {Promise<PostWithTags[]>}
     */
    query: (filters = {}) => ipcRenderer.invoke('posts:query', filters),

    /**
     * Fetch all posts (with tags) for export — returns plain JS array.
     * @param {{ sdgNumber?: number }} filters
     * @returns {Promise<PostWithTags[]>}
     */
    export: (filters = {}) => ipcRenderer.invoke('posts:export', filters),
  },

  // ── SDG metadata ─────────────────────────────────────────────────────────
  sdg: {
    /** @returns {Promise<SDGMeta[]>} */
    getMetadata: () => ipcRenderer.invoke('sdg:getMetadata'),
  },

  // ── Keywords file ─────────────────────────────────────────────────────────
  keywords: {
    /** @returns {Promise<string>} absolute path to the user-editable keywords.xlsx */
    getPath:      () => ipcRenderer.invoke('keywords:getPath'),
    /** Open keywords.xlsx in the system default app (Excel, LibreOffice, etc.) */
    openFile:     () => ipcRenderer.invoke('keywords:openFile'),
    /** Reveal keywords.xlsx in Finder / Explorer */
    showInFolder: () => ipcRenderer.invoke('keywords:showInFolder'),
  },

  // ── Dashboard stats ───────────────────────────────────────────────────────
  dashboard: {
    /**
     * Fetch aggregated metrics for the dashboard.
     * @param {{ platform?: string, pageId?: string }} filters
     * @returns {Promise<DashboardStats>}
     */
    stats: (filters = {}) => ipcRenderer.invoke('dashboard:stats', filters),
  },

  // ── Progress push events (main → renderer) ───────────────────────────────
  /**
   * Register a callback to receive job progress updates pushed from main.
   * @param {(data: { jobId: number, status: string, postsFound: number, message?: string }) => void} callback
   */
  onJobProgress: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('job:progress', handler)
    // Return a cleanup function so the renderer can unsubscribe
    return () => ipcRenderer.removeListener('job:progress', handler)
  },

  /**
   * Remove ALL job:progress listeners (use when component unmounts).
   */
  offJobProgress: () => ipcRenderer.removeAllListeners('job:progress'),
})
