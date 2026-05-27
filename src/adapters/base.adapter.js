/**
 * adapters/base.adapter.js
 *
 * Abstract base class for all platform scrapers. Every adapter must:
 *   1. Extend BaseAdapter
 *   2. Implement scrape(pageConfig) returning Promise<NormalizedPost[]>
 *   3. Use this.normalizePost() to build output objects
 *   4. Register itself in src/scraper/manager.js
 *
 * Normalised post schema:
 *   {
 *     id       : string   — globally unique: '{platform}:{pageId}:{nativePostId}'
 *     platform : string   — 'facebook' | 'wordpress' | ...
 *     pageId   : string   — platform page identifier
 *     text     : string   — cleaned plain-text post body
 *     hashtags : string[] — extracted hashtags (with or without leading #)
 *     date     : string   — ISO-8601 datetime or null
 *     url      : string   — permalink or null
 *     author   : string   — display name or user id or null
 *     rawHtml  : string   — original HTML blob or null
 *   }
 */

export class BaseAdapter {
  /**
   * @param {object} config  Platform-specific config passed from ScraperManager.
   *   Expected to include at minimum: { pageId, url }
   */
  constructor(config) {
    this.config = config
  }

  // ─── Interface ─────────────────────────────────────────────────────────────

  /**
   * Scrape posts from the given page config.
   * Must be implemented by all subclasses.
   *
   * @param {object} pageConfig  { platform, pageId, url, label, ...extras }
   * @returns {Promise<NormalizedPost[]>}
   */
  async scrape(pageConfig) { // eslint-disable-line no-unused-vars
    throw new Error(`${this.constructor.name}.scrape() is not implemented`)
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Build a normalised post object. Call this from subclass scrape() methods
   * rather than constructing the object manually — ensures all fields are
   * present with correct defaults.
   *
   * @param {object} fields
   * @returns {NormalizedPost}
   */
  normalizePost({ id, platform, pageId, text, hashtags, date, url, author, rawHtml }) {
    if (!id)       throw new Error('normalizePost: id is required')
    if (!platform) throw new Error('normalizePost: platform is required')
    if (!pageId)   throw new Error('normalizePost: pageId is required')

    return {
      id,
      platform,
      pageId,
      text:     typeof text === 'string' ? text.trim() : '',
      hashtags: Array.isArray(hashtags) ? hashtags : extractHashtags(text ?? ''),
      date:     date ?? null,
      url:      url ?? null,
      author:   author != null ? String(author) : null,
      rawHtml:  rawHtml ?? null,
    }
  }
}

// ─── Utility: hashtag extraction ──────────────────────────────────────────────

/**
 * Extract all #hashtags from a plain-text string.
 * Returns an array of strings with the leading # included.
 * Called automatically when hashtags is not provided to normalizePost().
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractHashtags(text) {
  if (!text) return []
  const matches = text.match(/#[A-Za-z][A-Za-z0-9_]*/g)
  return matches ?? []
}

/**
 * Strip HTML tags from a string, collapsing whitespace.
 * Useful in adapters that receive HTML and need plain text.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, ' ')        // remove tags
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
