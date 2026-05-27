/**
 * adapters/facebook.adapter.js
 *
 * Facebook Page scraper — Playwright-based.
 *
 * ─── STATUS: STUB ────────────────────────────────────────────────────────────
 *
 * Facebook aggressively blocks automated access. A working implementation
 * requires:
 *   1. A saved authenticated browser session (see "Session management" below)
 *   2. Randomised delays to avoid rate-limiting
 *   3. Selector maintenance — Facebook's DOM changes frequently
 *
 * This file provides the full skeleton with detailed TODO comments in each
 * section. The scrape() method throws NotImplementedError until fully
 * implemented.
 *
 * ─── Authentication approach ─────────────────────────────────────────────────
 *
 * Facebook cannot be automated with headless login (their bot detection blocks
 * it). The recommended flow is:
 *
 *   Step A — First run (manual):
 *     1. Call openLoginSession() to launch a visible Chromium window.
 *     2. Manually log in to Facebook in that window.
 *     3. Call saveSession() to persist cookies/localStorage to disk.
 *
 *   Step B — Subsequent runs (automated):
 *     1. launchPersistentContext() loads the saved userDataDir.
 *     2. Session cookies are already present — no login prompt.
 *     3. Periodically re-authenticate if the session expires.
 *
 * Session file is stored in Electron's userData directory:
 *   {userData}/sessions/facebook-session.json
 *
 * ─── Playwright notes ────────────────────────────────────────────────────────
 *
 * We use launchPersistentContext() (not browser.newContext()) because it
 * stores all browser state (cookies, localStorage, IndexedDB, cache) in a
 * real User Data Directory across restarts — equivalent to a real Chrome
 * profile. Reference: Playwright docs — BrowserType.launchPersistentContext()
 *
 * storageState({path}) saves current cookies/localStorage to JSON after a
 * scrape so the next run reuses the same session.
 */

import { chromium } from 'playwright'
import { join } from 'path'
import { app } from 'electron'
import { BaseAdapter, extractHashtags, stripHtml } from './base.adapter.js'

// ─── Selectors ────────────────────────────────────────────────────────────────
// IMPORTANT: These selectors break when Facebook updates their DOM. Update here
// when posts stop being detected. Consider using data-testid attributes
// (more stable than class names) when available.

const SELECTORS = {
  // Container wrapping individual feed posts
  POST_CONTAINER: '[data-pagelet^="FeedUnit"]',

  // Post body text within a post container
  POST_TEXT: '[data-ad-comet-preview="message"] span, [data-ad-preview="message"] span',

  // Timestamp / date link
  POST_TIMESTAMP: 'abbr[data-utime], a[aria-label][role="link"] abbr',

  // Post permalink link
  POST_LINK: 'a[href*="/posts/"], a[href*="/permalink/"]',

  // Author name
  POST_AUTHOR: 'strong a, h2 a[href*="facebook.com"]',

  // "See more" button that expands truncated text
  SEE_MORE_BTN: 'div[role="button"]:has-text("See more")',
}

// ─── Timing ───────────────────────────────────────────────────────────────────

/** Return a random delay in ms between min and max (inclusive). */
function randomDelay(min = 1500, max = 4000) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class FacebookAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
    this._userDataDir = join(app.getPath('userData'), 'sessions', 'facebook')
    this._sessionFile = join(app.getPath('userData'), 'sessions', 'facebook-session.json')
  }

  // ── Public: scrape ──────────────────────────────────────────────────────────

  /**
   * Scrape posts from a Facebook Page.
   *
   * @param {object} pageConfig
   * @param {string} pageConfig.pageId   Facebook page id or username
   * @param {string} pageConfig.url      Full Facebook page URL
   * @param {object} [pageConfig.options]
   * @param {number} [pageConfig.options.maxPosts=100]  Stop after this many posts
   * @param {number} [pageConfig.options.maxScrolls=30] Safety cap on scroll attempts
   *
   * @returns {Promise<NormalizedPost[]>}
   */
  async scrape(pageConfig) {
    // TODO: remove this throw and implement the sections below
    throw new Error(
      'FacebookAdapter is not yet implemented. ' +
      'See TODO comments in src/adapters/facebook.adapter.js for implementation guide.'
    )

    /* ────────────────────────────────────────────────────────────────────────
     * SECTION 1 — Launch persistent browser context
     * ────────────────────────────────────────────────────────────────────────
     * We use launchPersistentContext so that the Chromium User Data Directory
     * (cookies, localStorage, IndexedDB) persists across sessions. This is how
     * we maintain the Facebook login state without logging in every time.
     *
     * Reference: https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context
     *
     * TODO:
     *   const context = await chromium.launchPersistentContext(this._userDataDir, {
     *     headless: false,           // Facebook bot detection blocks headless mode
     *     slowMo: 50,                // Mimic human typing/click speed
     *     viewport: { width: 1280, height: 900 },
     *     userAgent: '...',          // Use a realistic desktop UA string
     *     locale: 'en-US',
     *   })
     *   const page = await context.newPage()
     */

    /* ────────────────────────────────────────────────────────────────────────
     * SECTION 2 — Check login state / restore session
     * ────────────────────────────────────────────────────────────────────────
     * After launching, navigate to facebook.com and check if we are logged in.
     * If not, pause and wait for manual login (or throw an error with instructions).
     *
     * Optionally, if a session JSON file exists, call:
     *   await context.setStorageState(this._sessionFile)
     * to restore previously saved cookies/localStorage.
     *
     * TODO:
     *   await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded' })
     *   const isLoggedIn = await page.$('[aria-label="Your profile"]') !== null
     *   if (!isLoggedIn) {
     *     // Option A: Throw error asking user to run openLoginSession() first
     *     throw new Error('Not logged in to Facebook. Run the session setup flow first.')
     *     // Option B: Wait for manual login (set a long timeout)
     *   }
     */

    /* ────────────────────────────────────────────────────────────────────────
     * SECTION 3 — Navigate to the target page
     * ────────────────────────────────────────────────────────────────────────
     * TODO:
     *   await page.goto(pageConfig.url, { waitUntil: 'networkidle', timeout: 30000 })
     *   await page.waitForSelector(SELECTORS.POST_CONTAINER, { timeout: 15000 })
     */

    /* ────────────────────────────────────────────────────────────────────────
     * SECTION 4 — Infinite scroll + post collection loop
     * ────────────────────────────────────────────────────────────────────────
     * Facebook loads posts lazily as the user scrolls. We must:
     *   a) Scroll down, wait for new posts to load
     *   b) Extract posts from the newly loaded DOM
     *   c) Repeat until maxPosts or maxScrolls is reached, or no new posts appear
     *
     * TODO:
     *   const { maxPosts = 100, maxScrolls = 30 } = pageConfig.options ?? {}
     *   const seenIds = new Set()
     *   let scrollCount = 0
     *
     *   while (seenIds.size < maxPosts && scrollCount < maxScrolls) {
     *     // Expand any "See more" buttons before extracting text
     *     const seeMoreBtns = await page.$$(SELECTORS.SEE_MORE_BTN)
     *     for (const btn of seeMoreBtns) {
     *       await btn.click().catch(() => {})  // ignore if already expanded
     *       await page.waitForTimeout(300)
     *     }
     *
     *     // Extract all visible post containers
     *     const postEls = await page.$$(SELECTORS.POST_CONTAINER)
     *     for (const el of postEls) {
     *       const rawData = await extractPostData(page, el, pageConfig.pageId)
     *       if (rawData && !seenIds.has(rawData.id)) {
     *         seenIds.add(rawData.id)
     *         posts.push(this.normalizePost(rawData))
     *       }
     *     }
     *
     *     // Scroll down
     *     const prevHeight = await page.evaluate(() => document.body.scrollHeight)
     *     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
     *     await page.waitForTimeout(randomDelay(1500, 4000))
     *
     *     // Check if more content loaded
     *     const newHeight = await page.evaluate(() => document.body.scrollHeight)
     *     if (newHeight === prevHeight) break  // no more content
     *     scrollCount++
     *   }
     */

    /* ────────────────────────────────────────────────────────────────────────
     * SECTION 5 — Save updated session state
     * ────────────────────────────────────────────────────────────────────────
     * After a successful scrape, persist the latest cookies/localStorage so
     * subsequent runs reuse the same session without re-authentication.
     *
     * Reference: https://playwright.dev/docs/auth#saving-authentication-state
     *
     * TODO:
     *   await context.storageState({ path: this._sessionFile })
     *   await context.close()
     */

    /* ────────────────────────────────────────────────────────────────────────
     * SECTION 6 — Return normalised posts
     * ────────────────────────────────────────────────────────────────────────
     * TODO:
     *   return posts
     */
  }

  // ── Public: session management ──────────────────────────────────────────────

  /**
   * Opens a visible browser window for manual Facebook login.
   * After logging in, the user should call saveSession() (or it is called
   * automatically when the window is closed, depending on implementation).
   *
   * TODO: implement this UI flow in the renderer (JobRunner page) with a
   * "Set up Facebook session" button that calls this via IPC.
   */
  async openLoginSession() {
    // TODO:
    // const context = await chromium.launchPersistentContext(this._userDataDir, {
    //   headless: false,
    // })
    // const page = await context.newPage()
    // await page.goto('https://www.facebook.com/login')
    // // Wait until user navigates away from login page (manual login complete)
    // await page.waitForURL(url => !url.includes('/login'), { timeout: 120000 })
    // await this.saveSession(context)
    // await context.close()
    throw new Error('openLoginSession() not yet implemented')
  }

  /**
   * Save the current browser session cookies/localStorage to disk.
   * @param {import('playwright').BrowserContext} context
   */
  async saveSession(context) {
    // TODO:
    // import { mkdirSync } from 'fs'
    // mkdirSync(dirname(this._sessionFile), { recursive: true })
    // await context.storageState({ path: this._sessionFile })
    throw new Error('saveSession() not yet implemented')
  }
}

// ─── Private: extract post data from a DOM element ───────────────────────────

/**
 * TODO: Implement this helper once SELECTORS are verified against live Facebook.
 *
 * Extracts raw data from a single post element. Called inside the scroll loop.
 *
 * @param {import('playwright').Page} _page
 * @param {import('playwright').ElementHandle} _el
 * @param {string} _pageId
 * @returns {Promise<object|null>}
 */
async function extractPostData(_page, _el, _pageId) {
  // TODO:
  // const text    = await _el.$eval(SELECTORS.POST_TEXT, el => el.innerText).catch(() => '')
  // const rawHtml = await _el.innerHTML()
  // const href    = await _el.$eval(SELECTORS.POST_LINK, el => el.href).catch(() => null)
  // const dateEl  = await _el.$(SELECTORS.POST_TIMESTAMP)
  // const utime   = dateEl ? await dateEl.getAttribute('data-utime') : null
  // const date    = utime ? new Date(parseInt(utime, 10) * 1000).toISOString() : null
  // const author  = await _el.$eval(SELECTORS.POST_AUTHOR, el => el.innerText).catch(() => null)
  //
  // // Derive a stable post ID from the permalink
  // const postIdMatch = href?.match(/\/(\d+)\/?$/)
  // const nativeId    = postIdMatch ? postIdMatch[1] : href ?? String(Date.now())
  // const id          = `facebook:${_pageId}:${nativeId}`
  //
  // return { id, platform: 'facebook', pageId: _pageId, text, hashtags: extractHashtags(text), date, url: href, author, rawHtml }
  return null
}
