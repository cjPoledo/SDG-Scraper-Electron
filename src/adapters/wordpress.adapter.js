/**
 * adapters/wordpress.adapter.js
 *
 * WordPress scraper — uses the WP REST API as the primary method.
 * Falls back to Playwright for password-protected or non-standard sites.
 *
 * ─── REST API (functional for public sites) ──────────────────────────────────
 *
 * The WordPress REST API endpoint is:
 *   GET {siteUrl}/wp-json/wp/v2/posts?per_page=100&page=N&_fields=...
 *
 * This works on any public WordPress site running WP 4.7+ with the REST API
 * enabled (enabled by default). Private/password-protected posts are excluded
 * unless Basic Auth or Application Passwords are configured.
 *
 * Pagination: WP REST API uses page-based pagination with a max of 100
 * posts per request. The loop runs until an empty page is returned or the
 * X-WP-Total header indicates no more pages.
 *
 * ─── Playwright fallback (stubbed) ───────────────────────────────────────────
 *
 * Used when the REST API returns 401 (auth required), 403 (forbidden),
 * or 404 (API not available). See TODO comments in scrapeViaPlaywright().
 */

import { chromium } from 'playwright'
import { BaseAdapter, extractHashtags, stripHtml } from './base.adapter.js'

export class WordPressAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
  }

  // ── Main entry ──────────────────────────────────────────────────────────────

  /**
   * @param {object} pageConfig
   * @param {string} pageConfig.pageId  Domain or slug (used as the page identifier)
   * @param {string} pageConfig.url     WordPress site root URL
   * @param {object} [pageConfig.options]
   * @param {string} [pageConfig.options.username]  Basic Auth username (optional)
   * @param {string} [pageConfig.options.password]  Basic Auth password / App Password
   * @param {number} [pageConfig.options.maxPosts]  Cap total posts fetched (default: unlimited)
   * @returns {Promise<NormalizedPost[]>}
   */
  async scrape(pageConfig) {
    try {
      return await this.scrapeViaRestApi(pageConfig)
    } catch (err) {
      if (err.code === 'REST_API_UNAVAILABLE' || err.code === 'REST_API_AUTH_REQUIRED') {
        console.warn(
          `[wordpress] REST API unavailable for ${pageConfig.url} (${err.message}). ` +
          `Falling back to Playwright.`
        )
        return await this.scrapeViaPlaywright(pageConfig)
      }
      throw err
    }
  }

  // ── REST API scraper (functional) ───────────────────────────────────────────

  /**
   * Fetch all posts via the WP REST API.
   * Handles pagination automatically; stops when no more posts or maxPosts reached.
   *
   * @param {object} pageConfig
   * @returns {Promise<NormalizedPost[]>}
   */
  async scrapeViaRestApi(pageConfig) {
    const base = pageConfig.url.replace(/\/+$/, '') // strip trailing slash
    const { username, password, maxPosts = Infinity } = pageConfig.options ?? {}

    // Build common request headers
    const headers = { Accept: 'application/json' }
    if (username && password) {
      // WP Application Passwords or Basic Auth
      headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`
    }

    const posts = []
    let page = 1
    let totalPages = null

    while (posts.length < maxPosts) {
      const remaining = maxPosts - posts.length
      const perPage = Math.min(100, remaining)

      const url =
        `${base}/wp-json/wp/v2/posts` +
        `?per_page=${perPage}` +
        `&page=${page}` +
        `&_fields=id,date,link,content,excerpt,author,tags,categories,status` +
        `&orderby=date&order=desc`

      let res
      try {
        res = await fetch(url, { headers })
      } catch (networkErr) {
        throw Object.assign(
          new Error(`Network error fetching ${url}: ${networkErr.message}`),
          { code: 'NETWORK_ERROR' }
        )
      }

      // Handle auth / not found
      if (res.status === 401 || res.status === 403) {
        throw Object.assign(
          new Error(`WP REST API returned ${res.status} — authentication required`),
          { code: 'REST_API_AUTH_REQUIRED' }
        )
      }
      if (res.status === 404) {
        throw Object.assign(
          new Error(`WP REST API not found at ${base}/wp-json/wp/v2/posts — API may be disabled`),
          { code: 'REST_API_UNAVAILABLE' }
        )
      }
      if (!res.ok) {
        throw new Error(`WP REST API returned HTTP ${res.status} for ${url}`)
      }

      // Capture total pages from header (available on first request)
      if (totalPages === null) {
        const total = res.headers.get('X-WP-TotalPages')
        totalPages = total ? parseInt(total, 10) : null
      }

      const batch = await res.json()
      if (!Array.isArray(batch) || batch.length === 0) break

      for (const wpPost of batch) {
        const text = stripHtml(
          wpPost.content?.rendered ?? wpPost.excerpt?.rendered ?? ''
        )
        posts.push(
          this.normalizePost({
            id:       `wordpress:${pageConfig.pageId}:${wpPost.id}`,
            platform: 'wordpress',
            pageId:   pageConfig.pageId,
            text,
            hashtags: extractHashtags(text),
            date:     wpPost.date ?? null,           // ISO-8601 from WP
            url:      wpPost.link ?? null,
            author:   wpPost.author != null ? String(wpPost.author) : null,
            rawHtml:  wpPost.content?.rendered ?? null,
          })
        )
      }

      // Stop if we've reached the last page
      if (totalPages !== null && page >= totalPages) break
      if (batch.length < perPage) break // last partial page
      page++
    }

    return posts
  }

  // ── Playwright fallback (stub) ──────────────────────────────────────────────

  /**
   * Scrape a WordPress site using Playwright when the REST API is not available.
   * Typically needed for: password-protected sites, paywalled content, or sites
   * with the REST API intentionally disabled.
   *
   * ─── STATUS: STUB ────────────────────────────────────────────────────────
   *
   * TODO: implement the sections below.
   *
   * @param {object} _pageConfig
   * @returns {Promise<NormalizedPost[]>}
   */
  async scrapeViaPlaywright(_pageConfig) {
    // TODO: remove this throw and implement the sections below
    throw new Error(
      'WordPressAdapter Playwright fallback is not yet implemented. ' +
      'See TODO comments in src/adapters/wordpress.adapter.js.'
    )

    /* ────────────────────────────────────────────────────────────────────────
     * SECTION 1 — Launch browser
     * ────────────────────────────────────────────────────────────────────────
     * WordPress sites are generally accessible headlessly. Use a real UA to
     * avoid bot detection on more restricted sites.
     *
     * TODO:
     *   const browser = await chromium.launch({ headless: true })
     *   const context = await browser.newContext({
     *     userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
     *   })
     *   const page = await context.newPage()
     */

    /* ────────────────────────────────────────────────────────────────────────
     * SECTION 2 — Optional: Authenticate
     * ────────────────────────────────────────────────────────────────────────
     * If the site requires a login (e.g. membership content), navigate to the
     * login page and fill in credentials before navigating to the blog index.
     *
     * TODO (if auth needed):
     *   if (_pageConfig.options?.username) {
     *     await page.goto(`${base}/wp-login.php`)
     *     await page.fill('#user_login', _pageConfig.options.username)
     *     await page.fill('#user_pass',  _pageConfig.options.password)
     *     await page.click('#wp-submit')
     *     await page.waitForNavigation()
     *   }
     */

    /* ────────────────────────────────────────────────────────────────────────
     * SECTION 3 — Iterate paginated archive pages
     * ────────────────────────────────────────────────────────────────────────
     * Standard WP themes paginate the blog archive at:
     *   {siteUrl}/page/2/, /page/3/, etc.
     *
     * Extract article links from each archive page, then visit each article
     * page to get the full post content.
     *
     * TODO:
     *   let archivePage = 1
     *   const postLinks = []
     *   while (true) {
     *     const archiveUrl = archivePage === 1
     *       ? _pageConfig.url
     *       : `${_pageConfig.url}/page/${archivePage}/`
     *     await page.goto(archiveUrl, { waitUntil: 'domcontentloaded' })
     *
     *     // Common selectors for post links in archive pages
     *     const links = await page.$$eval(
     *       'article a[rel="bookmark"], h2.entry-title a, h1.entry-title a',
     *       els => els.map(el => el.href)
     *     )
     *     if (!links.length) break
     *     postLinks.push(...links)
     *     archivePage++
     *   }
     */

    /* ────────────────────────────────────────────────────────────────────────
     * SECTION 4 — Scrape individual post pages
     * ────────────────────────────────────────────────────────────────────────
     * TODO:
     *   const posts = []
     *   for (const link of postLinks) {
     *     await page.goto(link, { waitUntil: 'domcontentloaded' })
     *     const rawHtml = await page.$eval('article .entry-content', el => el.innerHTML)
     *       .catch(() => '')
     *     const text   = stripHtml(rawHtml)
     *     const date   = await page.$eval('time.entry-date', el => el.getAttribute('datetime'))
     *       .catch(() => null)
     *     const author = await page.$eval('.author.vcard a', el => el.innerText)
     *       .catch(() => null)
     *     const nativeId = new URL(link).pathname.replace(/\//g, '-').slice(1)
     *
     *     posts.push(this.normalizePost({
     *       id: `wordpress:${_pageConfig.pageId}:${nativeId}`,
     *       platform: 'wordpress',
     *       pageId: _pageConfig.pageId,
     *       text, hashtags: extractHashtags(text), date, url: link, author, rawHtml,
     *     }))
     *   }
     */

    /* ────────────────────────────────────────────────────────────────────────
     * SECTION 5 — Cleanup and return
     * ────────────────────────────────────────────────────────────────────────
     * TODO:
     *   await browser.close()
     *   return posts
     */
  }
}
