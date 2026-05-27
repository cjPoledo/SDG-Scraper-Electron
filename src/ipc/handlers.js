/**
 * ipc/handlers.js
 *
 * Registers all ipcMain.handle() channels. Each handler corresponds 1:1 with
 * an entry in src/preload.js.
 *
 * Pattern: ipcMain.handle(channel, async (event, ...args) => { ... })
 * Return value is automatically sent back to ipcRenderer.invoke() caller.
 */

import { ScraperManager } from '../scraper/manager.js'
import { SDG_METADATA } from '../tagging/sdg-metadata.js'

/** @param {Electron.IpcMain} ipcMain */
/** @param {import('better-sqlite3').Database} db */
/** @param {() => Electron.BrowserWindow | null} getMainWindow — getter so we always use the current window */
export function registerIpcHandlers(ipcMain, db, getMainWindow) {
  const scraper = new ScraperManager(db)

  /** Send a push event to the renderer if the window is alive */
  const send = (channel, data) => getMainWindow()?.webContents?.send(channel, data)

  // ── Pages ─────────────────────────────────────────────────────────────────

  ipcMain.handle('pages:list', async () => {
    return db.prepare('SELECT * FROM pages ORDER BY created_at DESC').all()
  })

  ipcMain.handle('pages:add', async (_event, { platform, url, pageId, label }) => {
    if (!platform || !url || !pageId) {
      throw new Error('platform, url, and pageId are required')
    }
    const stmt = db.prepare(
      'INSERT INTO pages (platform, page_id, url, label) VALUES (?, ?, ?, ?)'
    )
    const info = stmt.run(platform, pageId, url, label ?? null)
    return { id: info.lastInsertRowid }
  })

  ipcMain.handle('pages:remove', async (_event, id) => {
    db.prepare('DELETE FROM pages WHERE id = ?').run(id)
  })

  // ── Scrape jobs ───────────────────────────────────────────────────────────

  ipcMain.handle('jobs:start', async (_event, pageId) => {
    // Look up the page config
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId)
    if (!page) throw new Error(`Page ${pageId} not found`)

    // Create a job row in pending state
    const jobInfo = db
      .prepare(
        'INSERT INTO scrape_jobs (page_id, status, started_at) VALUES (?, ?, datetime(\'now\'))'
      )
      .run(pageId, 'running')
    const jobId = jobInfo.lastInsertRowid

    // Run the scraper asynchronously — don't await here so the IPC response
    // returns the jobId immediately and progress events stream back via push.
    scraper
      .run(
        jobId,
        {
          platform: page.platform,
          pageId: page.page_id,
          url: page.url,
          label: page.label,
        },
        (progressData) => {
          send('job:progress', progressData)
        }
      )
      .then(() => {
        // manager.run() already emits the final 'done' progress event;
        // here we just persist finished_at to the DB.
        db.prepare(
          'UPDATE scrape_jobs SET status = ?, finished_at = datetime(\'now\') WHERE id = ?'
        ).run('done', jobId)
      })
      .catch((err) => {
        console.error(`Job ${jobId} failed:`, err)
        db.prepare(
          'UPDATE scrape_jobs SET status = ?, error = ?, finished_at = datetime(\'now\') WHERE id = ?'
        ).run('error', err.message, jobId)
        send('job:progress', {
          jobId,
          status: 'error',
          message: err.message,
        })
      })

    return { jobId }
  })

  ipcMain.handle('jobs:getStatus', async (_event, jobId) => {
    return db.prepare('SELECT * FROM scrape_jobs WHERE id = ?').get(jobId)
  })

  ipcMain.handle('jobs:remove', async (_event, jobId) => {
    const job = db.prepare('SELECT * FROM scrape_jobs WHERE id = ?').get(jobId)
    if (!job) throw new Error(`Job ${jobId} not found`)

    // Don't allow deleting a running job
    if (job.status === 'running' || job.status === 'tagging') {
      throw new Error('Cannot delete a job that is still running')
    }

    // Look up the page's page_id (text) to match posts
    const page = db.prepare('SELECT page_id FROM pages WHERE id = ?').get(job.page_id)

    db.transaction(() => {
      // Delete posts scraped during this job's time window for this page.
      // sdg_tags are deleted automatically via ON DELETE CASCADE on posts.
      if (page && job.started_at) {
        const finished = job.finished_at ?? new Date().toISOString()
        db.prepare(`
          DELETE FROM posts
          WHERE page_id = ?
            AND scraped_at >= ?
            AND scraped_at <= ?
        `).run(page.page_id, job.started_at, finished)
      }

      // Delete the job row itself
      db.prepare('DELETE FROM scrape_jobs WHERE id = ?').run(jobId)
    })()
  })

  ipcMain.handle('jobs:list', async () => {
    return db
      .prepare(
        `SELECT j.*, p.url, p.platform, p.label
         FROM scrape_jobs j
         LEFT JOIN pages p ON p.id = j.page_id
         ORDER BY j.id DESC
         LIMIT 100`
      )
      .all()
  })

  // ── Posts & SDG tags ──────────────────────────────────────────────────────

  ipcMain.handle('posts:query', async (_event, filters = {}) => {
    const { sdgNumber, platform, pageId, limit = 200, offset = 0 } = filters

    // Build WHERE clauses dynamically
    const whereParts = []
    const params     = []

    if (sdgNumber) {
      // SDG-filtered path: JOIN sdg_tags (one row per tag per post)
      whereParts.push('t.sdg_number = ?'); params.push(sdgNumber)
      if (platform) { whereParts.push('p.platform = ?'); params.push(platform) }
      if (pageId)   { whereParts.push('p.page_id = ?');  params.push(pageId)   }
      const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

      return db
        .prepare(
          `SELECT p.*, t.sdg_number, t.confidence, t.matched_on
           FROM posts p
           JOIN sdg_tags t ON t.post_id = p.id
           ${where}
           ORDER BY p.date DESC
           LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset)
    }

    // No SDG filter: GROUP_CONCAT path
    if (platform) { whereParts.push('p.platform = ?'); params.push(platform) }
    if (pageId)   { whereParts.push('p.page_id = ?');  params.push(pageId)   }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

    return db
      .prepare(
        `SELECT p.*,
                GROUP_CONCAT(t.sdg_number) AS sdg_numbers,
                GROUP_CONCAT(t.confidence) AS confidences,
                GROUP_CONCAT(t.matched_on) AS matched_on
         FROM posts p
         LEFT JOIN sdg_tags t ON t.post_id = p.id
         ${where}
         GROUP BY p.id
         ORDER BY p.date DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset)
  })

  ipcMain.handle('posts:export', async (_event, filters = {}) => {
    const { sdgNumber, platform, pageId } = filters

    const whereParts = []
    const params     = []

    if (sdgNumber) {
      whereParts.push('t.sdg_number = ?'); params.push(sdgNumber)
      if (platform) { whereParts.push('p.platform = ?'); params.push(platform) }
      if (pageId)   { whereParts.push('p.page_id = ?');  params.push(pageId)   }
      const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

      return db
        .prepare(
          `SELECT p.id, p.platform, p.page_id, p.text, p.hashtags,
                  p.date, p.url, p.author,
                  t.sdg_number, t.confidence, t.matched_on
           FROM posts p
           JOIN sdg_tags t ON t.post_id = p.id
           ${where}
           ORDER BY p.date DESC`
        )
        .all(...params)
    }

    if (platform) { whereParts.push('p.platform = ?'); params.push(platform) }
    if (pageId)   { whereParts.push('p.page_id = ?');  params.push(pageId)   }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

    return db
      .prepare(
        `SELECT p.id, p.platform, p.page_id, p.text, p.hashtags,
                p.date, p.url, p.author,
                GROUP_CONCAT(t.sdg_number) AS sdg_numbers,
                GROUP_CONCAT(t.confidence) AS confidences,
                GROUP_CONCAT(t.matched_on) AS matched_on
         FROM posts p
         LEFT JOIN sdg_tags t ON t.post_id = p.id
         ${where}
         GROUP BY p.id
         ORDER BY p.date DESC`
      )
      .all(...params)
  })

  // ── SDG metadata ──────────────────────────────────────────────────────────

  ipcMain.handle('sdg:getMetadata', async () => {
    return SDG_METADATA
  })

  // ── Dashboard stats ───────────────────────────────────────────────────────

  ipcMain.handle('dashboard:stats', async (_event, filters = {}) => {
    const { platform, pageId } = filters

    // Build a reusable WHERE fragment for posts filtered by platform / page
    const postWhereParts = []
    const postWhereParams = []
    if (platform) { postWhereParts.push('p.platform = ?'); postWhereParams.push(platform) }
    if (pageId)   { postWhereParts.push('p.page_id = ?');  postWhereParams.push(pageId)   }
    const postWhere = postWhereParts.length ? `WHERE ${postWhereParts.join(' AND ')}` : ''

    // Same but for the sdg_tags join path
    const tagWhereParts = [...postWhereParts]
    const tagWhereParams = [...postWhereParams]
    const tagWhere = tagWhereParts.length ? `WHERE ${tagWhereParts.join(' AND ')}` : ''

    // ── Totals ──────────────────────────────────────────────────────────────
    const { total_posts } = db.prepare(
      `SELECT COUNT(*) AS total_posts FROM posts p ${postWhere}`
    ).get(...postWhereParams)

    const { tagged_posts } = db.prepare(
      `SELECT COUNT(DISTINCT p.id) AS tagged_posts
       FROM posts p
       JOIN sdg_tags t ON t.post_id = p.id
       ${tagWhere}`
    ).get(...tagWhereParams)

    const { total_tags } = db.prepare(
      `SELECT COUNT(*) AS total_tags
       FROM sdg_tags t
       JOIN posts p ON p.id = t.post_id
       ${tagWhere}`
    ).get(...tagWhereParams)

    const { total_jobs } = db.prepare(
      `SELECT COUNT(*) AS total_jobs FROM scrape_jobs`
    ).get()

    // ── Posts per SDG ───────────────────────────────────────────────────────
    const bySDG = db.prepare(
      `SELECT t.sdg_number, COUNT(DISTINCT p.id) AS post_count
       FROM sdg_tags t
       JOIN posts p ON p.id = t.post_id
       ${tagWhere}
       GROUP BY t.sdg_number
       ORDER BY t.sdg_number ASC`
    ).all(...tagWhereParams)

    // ── Confidence breakdown ────────────────────────────────────────────────
    const byConfidence = db.prepare(
      `SELECT t.confidence, COUNT(*) AS count
       FROM sdg_tags t
       JOIN posts p ON p.id = t.post_id
       ${tagWhere}
       GROUP BY t.confidence`
    ).all(...tagWhereParams)

    // ── Posts per platform ──────────────────────────────────────────────────
    const byPlatform = db.prepare(
      `SELECT p.platform, COUNT(*) AS post_count
       FROM posts p ${postWhere}
       GROUP BY p.platform
       ORDER BY post_count DESC`
    ).all(...postWhereParams)

    // ── Posts per page ──────────────────────────────────────────────────────
    const byPage = db.prepare(
      `SELECT p.page_id, pg.label, pg.url, pg.platform,
              COUNT(*) AS post_count
       FROM posts p
       LEFT JOIN pages pg ON pg.page_id = p.page_id AND pg.platform = p.platform
       ${postWhere}
       GROUP BY p.page_id
       ORDER BY post_count DESC
       LIMIT 20`
    ).all(...postWhereParams)

    // ── Posts over time (monthly buckets, most recent 24 months) ────────────
    // Build a separate where for this query that also filters out null dates
    const monthWhereParts = [...postWhereParts, 'p.date IS NOT NULL']
    const monthWhere = `WHERE ${monthWhereParts.join(' AND ')}`
    const byMonth = db.prepare(
      `SELECT month, post_count FROM (
         SELECT strftime('%Y-%m', p.date) AS month, COUNT(*) AS post_count
         FROM posts p
         ${monthWhere}
         GROUP BY month
         ORDER BY month DESC
         LIMIT 24
       ) ORDER BY month ASC`
    ).all(...postWhereParams)

    // ── Top matched keywords ────────────────────────────────────────────────
    const topKeywords = db.prepare(
      `SELECT t.matched_on, t.confidence, t.sdg_number, COUNT(*) AS count
       FROM sdg_tags t
       JOIN posts p ON p.id = t.post_id
       WHERE t.matched_on IS NOT NULL
       ${tagWhereParts.length ? 'AND ' + tagWhereParts.join(' AND ') : ''}
       GROUP BY t.matched_on, t.sdg_number
       ORDER BY count DESC
       LIMIT 15`
    ).all(...tagWhereParams)

    // ── Recent jobs ─────────────────────────────────────────────────────────
    const recentJobs = db.prepare(
      `SELECT j.id, j.status, j.posts_found, j.started_at, j.finished_at,
              p.label, p.url, p.platform
       FROM scrape_jobs j
       LEFT JOIN pages p ON p.id = j.page_id
       ORDER BY j.id DESC
       LIMIT 5`
    ).all()

    return {
      totals: { total_posts, tagged_posts, total_tags, total_jobs },
      bySDG,
      byConfidence,
      byPlatform,
      byPage,
      byMonth,
      topKeywords,
      recentJobs,
    }
  })
}
