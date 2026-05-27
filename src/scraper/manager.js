/**
 * scraper/manager.js
 *
 * The ScraperManager is the central dispatch point for all scrape jobs.
 * It:
 *   1. Maintains a registry of platform → adapter class
 *   2. Instantiates the correct adapter for a given job
 *   3. Runs the adapter and persists posts + SDG tags to SQLite
 *   4. Emits progress updates via the onProgress callback
 *
 * ─── Adding a new adapter ────────────────────────────────────────────────────
 *   1. Create src/adapters/{platform}.adapter.js extending BaseAdapter
 *   2. Import the class here
 *   3. Add an entry to the ADAPTERS map below
 *   That's all — the rest of the pipeline picks it up automatically.
 */

import { FacebookAdapter }  from '../adapters/facebook.adapter.js'
import { WordPressAdapter } from '../adapters/wordpress.adapter.js'
import { loadKeywords }     from '../tagging/keywords.js'
import { buildEngine }      from '../tagging/engine.js'
import { join, dirname }    from 'path'
import { fileURLToPath }    from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Adapter registry ─────────────────────────────────────────────────────────
// Maps platform string (as stored in the pages table) → adapter constructor.

const ADAPTERS = {
  facebook:  FacebookAdapter,
  wordpress: WordPressAdapter,
}

// ─── Manager ──────────────────────────────────────────────────────────────────

export class ScraperManager {
  /**
   * @param {import('better-sqlite3').Database} db
   */
  constructor(db) {
    this.db = db

    // Load keyword map once at construction time (synchronous xlsx parse).
    // If keywords.xlsx is missing, the tagging engine falls back to hashtag-only.
    try {
      this.keywordMap = loadKeywords(
        join(__dirname, '../tagging/keywords.xlsx')
      )
    } catch (err) {
      console.warn(
        '[scraper] keywords.xlsx not found or failed to load — keyword matching disabled.',
        err.message
      )
      this.keywordMap = new Map()
    }

    this.engine = buildEngine(this.keywordMap)
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Run a scrape job end-to-end.
   *
   * Flow:
   *   1. Instantiate the correct adapter
   *   2. Scrape posts
   *   3. Tag each post with SDGs
   *   4. Persist posts + tags to SQLite (upsert — re-running is idempotent)
   *   5. Update the job's posts_found counter
   *
   * @param {number} jobId
   * @param {object} pageConfig   { platform, pageId, url, label, options? }
   * @param {(data: object) => void} onProgress   Called with progress updates
   * @returns {Promise<void>}
   */
  async run(jobId, pageConfig, onProgress = () => {}) {
    const AdapterClass = ADAPTERS[pageConfig.platform]
    if (!AdapterClass) {
      throw new Error(
        `Unknown platform: "${pageConfig.platform}". ` +
        `Registered platforms: ${Object.keys(ADAPTERS).join(', ')}`
      )
    }

    onProgress({ jobId, status: 'running', message: 'Starting scrape…', postsFound: 0 })

    const adapter = new AdapterClass(pageConfig)
    const posts = await adapter.scrape(pageConfig)

    onProgress({
      jobId,
      status: 'tagging',
      message: `Scraped ${posts.length} posts. Tagging…`,
      postsFound: posts.length,
    })

    // Tag and persist in one transaction per batch for performance
    const insertPost = this.db.prepare(`
      INSERT OR IGNORE INTO posts (id, platform, page_id, text, hashtags, date, url, author, raw_html)
      VALUES (@id, @platform, @pageId, @text, @hashtags, @date, @url, @author, @rawHtml)
    `)

    const insertTag = this.db.prepare(`
      INSERT OR IGNORE INTO sdg_tags (post_id, sdg_number, confidence, matched_on)
      VALUES (@postId, @sdgNumber, @confidence, @matchedOn)
    `)

    const updateJobCount = this.db.prepare(`
      UPDATE scrape_jobs SET posts_found = ? WHERE id = ?
    `)

    // Process in batches of 50 to avoid holding a giant transaction open
    const BATCH = 50
    let saved = 0

    for (let i = 0; i < posts.length; i += BATCH) {
      const batch = posts.slice(i, i + BATCH)

      await this.db.transaction(async () => {
        for (const post of batch) {
          // Persist the post
          insertPost.run({
            id:       post.id,
            platform: post.platform,
            pageId:   post.pageId,
            text:     post.text,
            hashtags: JSON.stringify(post.hashtags ?? []),
            date:     post.date,
            url:      post.url,
            author:   post.author,
            rawHtml:  post.rawHtml,
          })

          // Tag the post
          const tags = await this.engine.tagPost(post)
          for (const tag of tags) {
            insertTag.run({
              postId:     post.id,
              sdgNumber:  tag.sdgNumber,
              confidence: tag.confidence,
              matchedOn:  tag.matchedOn ?? null,
            })
          }

          saved++
        }

        updateJobCount.run(saved, jobId)
      })()

      onProgress({
        jobId,
        status: 'running',
        message: `Saved ${saved}/${posts.length} posts…`,
        postsFound: saved,
      })
    }

    onProgress({
      jobId,
      status: 'done',
      message: `Done. ${saved} posts saved.`,
      postsFound: saved,
    })
  }
}
