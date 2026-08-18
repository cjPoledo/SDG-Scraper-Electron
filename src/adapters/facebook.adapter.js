/**
 * adapters/facebook.adapter.js
 *
 * Facebook Page scraper — Playwright-based.
 *
 * ─── Authentication approach ─────────────────────────────────────────────────
 *
 * Facebook cannot be automated with headless login (their bot detection blocks
 * it). The recommended flow is:
 *
 *   Step A — First run (manual):
 *     1. Call openLoginSession() to launch a visible Chromium window.
 *     2. Manually log in to Facebook in that window.
 *     3. Session is saved automatically when the login window closes.
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
 * We use launchPersistentContext() because it stores all browser state
 * (cookies, localStorage, IndexedDB, cache) in a real User Data Directory
 * across restarts — equivalent to a real Chrome profile.
 *
 * storageState({path}) saves current cookies/localStorage to JSON after a
 * scrape so the next run reuses the same session.
 */

import { chromium } from 'playwright'
import { join, dirname } from 'path'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { app } from 'electron'
import { BaseAdapter, extractHashtags } from './base.adapter.js'

// ─── Selectors ────────────────────────────────────────────────────────────────
// IMPORTANT: These selectors break when Facebook updates their DOM. Update here
// when posts stop being detected. Consider using data-testid attributes
// (more stable than class names) when available.

const SELECTORS = {
  // Container wrapping individual feed posts — story_message is present in every real post
  POST_CONTAINER: '[data-ad-rendering-role="story_message"]',

  // Post body text — story_message wraps the full post body
  POST_TEXT: '[data-ad-rendering-role="story_message"]',

  // Post permalink — pfbid and numeric /posts/ both appear; story_fbid is a fallback
  POST_LINK: 'a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid="]',

  // Author: h3 > a > b > span is the current structure
  POST_AUTHOR: 'h3 a b span, h3 a',
}

// "See more" / expander button labels, by locale. Matched case-insensitively
// against trimmed innerText — exact-match only (loose substring matching risks
// clicking unrelated buttons like "See more comments" or "See more reactions").
// Add locales here as they're encountered; unmatched locales silently leave
// truncated post text, so extend this list rather than loosening the match.
const SEE_MORE_LABELS = [
  'see more',      // English
  'tumingin pa',   // Filipino
]

// ─── Timing ───────────────────────────────────────────────────────────────────

function randomDelay(min = 1500, max = 4000) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Repeatedly clicks every visible "See more" style expander button until a
// pass finds none left — a single pass can miss buttons revealed by an
// earlier click (e.g. a truncated shared post nested inside a truncated
// post). Capped to avoid ever looping indefinitely on a rendering glitch.
// Returns the total number of buttons clicked across all passes.
async function expandSeeMoreButtons(page, maxPasses = 10) {
  let total = 0
  for (let pass = 0; pass < maxPasses; pass++) {
    const clicked = await page.evaluate((labels) => {
      const results = []
      const allBtns = [...document.querySelectorAll('[role="button"]')]
      for (const btn of allBtns) {
        const text = btn.innerText?.trim().toLowerCase()
        if (text && labels.includes(text)) {
          btn.click()
          results.push(text)
        }
      }
      return results.length
    }, SEE_MORE_LABELS)

    if (clicked === 0) break
    total += clicked
    await page.waitForTimeout(600)
  }
  return total
}

// Playwright throws these when the user closes the browser window mid-scrape.
function isTargetClosedError(err) {
  return /target (page|closed)|has been closed/i.test(err?.message ?? '')
}

// Facebook's checkpoint/2FA flow often fires a second, client-side redirect
// before the first navigation's load events settle (e.g. it lands on a generic
// checkpoint URL, then almost immediately redirects to the specific challenge
// step). Playwright's waitForURL/waitForNavigation treats the interrupted first
// navigation as an error ("... maybe frame was detached?") even though the page
// is still open and the flow is still progressing — this is not a real close.
function isNavigationInterruptedError(err) {
  return /frame was detached|navigation.*(cancel|abort)/i.test(err?.message ?? '')
}

// ─── Shared launch options ────────────────────────────────────────────────────

function makeLaunchOptions(locale = 'fil') {
  return {
    headless: false,
    slowMo: 50,
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale,
  }
}

// ─── Date parsing ─────────────────────────────────────────────────────────────
// Facebook's aria-label date strings vary by locale and age of post:
//   Filipino: "Mayo 14 nang 8:43 AM", "Abril 3, 2024 nang 10:15 AM"
//   English:  "May 14 at 8:43 AM", "April 3, 2024 at 10:15 AM"
// Posts from the current year omit the year — we infer it.

const FIL_MONTHS = {
  enero:1, pebrero:2, marso:3, abril:4, mayo:5, hunyo:6,
  hulyo:7, agosto:8, setyembre:9, oktubre:10, nobyembre:11, disyembre:12,
}
const EN_MONTHS = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
}

function parseFacebookDate(raw) {
  if (!raw) return null
  // Normalize: collapse whitespace, lower
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ')

  // Relative dates: "5d", "3h", "45m", "2w" — resolve against today
  const rel = s.match(/^(\d+)(m|h|d|w)$/)
  if (rel) {
    const n = parseInt(rel[1], 10)
    const unit = rel[2]
    const ms = { m: 60000, h: 3600000, d: 86400000, w: 604800000 }[unit]
    const dt = new Date(Date.now() - n * ms)
    const pad = x => String(x).padStart(2, '0')
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
  }

  // Try to extract parts: month day [year] [at|nang] HH:MM AM/PM
  // Patterns:
  //   "mayo 14 nang 8:43 am"
  //   "abril 3, 2024 nang 10:15 am"
  //   "may 14 at 8:43 am"
  //   "april 3, 2024 at 10:15 am"
  // Match: "Month Day [Year] [nang|at HH:MM am/pm]"
  const m = s.match(
    /^([a-záéíóúñ]+)\s+(\d{1,2}),?\s*(?:(\d{4}))?\s*(?:(?:nang|at)\s+(\d{1,2}):(\d{2})\s*(am|pm))?/
  )
  if (!m) return null

  const [, monthStr, dayStr, yearStr, hourStr, minStr, ampm] = m
  const month = FIL_MONTHS[monthStr] ?? EN_MONTHS[monthStr]
  if (!month) return null

  const day  = parseInt(dayStr, 10)
  const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear()

  const pad = n => String(n).padStart(2, '0')

  if (!hourStr) {
    // Date only — no time component
    return `${year}-${pad(month)}-${pad(day)}`
  }

  let hour = parseInt(hourStr, 10)
  const min = parseInt(minStr, 10)
  if (ampm === 'pm' && hour !== 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0

  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(min)}:00`
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class FacebookAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
    this._userDataDir = join(app.getPath('userData'), 'sessions', 'facebook')
    this._sessionFile = join(app.getPath('userData'), 'sessions', 'facebook-session.json')
    // Set after scrape() resolves — lets the caller (ScraperManager) tell whether
    // the returned posts are a full result or a partial one cut short by the user
    // closing the browser window mid-scrape.
    this.lastScrapeMeta = { partial: false }
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
    this.lastScrapeMeta = { partial: false }

    // ── Section 1: Launch persistent browser context ──────────────────────────
    // The UDD carries all cookies/localStorage across runs automatically.
    // No storageState needed — launchPersistentContext doesn't support it.
    mkdirSync(this._userDataDir, { recursive: true })
    const context = await chromium.launchPersistentContext(this._userDataDir, makeLaunchOptions())
    const page = await context.newPage()

    // Block images, video, audio, fonts, and tracking pixels to speed up page load.
    // XHR/fetch (GraphQL) must remain unblocked — Facebook's feed data comes through them.
    await page.route('**/*', (route) => {
      const type = route.request().resourceType()
      if (['image', 'media', 'font', 'other'].includes(type)) {
        route.abort()
      } else {
        route.continue()
      }
    })

    try {
      // ── Section 2 + 3: Navigate to target page ───────────────────────────────
      // Navigate to the /posts tab
      const postsUrl = pageConfig.url.replace(/\/?$/, '/posts')
      try {
        await page.goto(postsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      } catch (err) {
        // Window closed before the page even loaded — nothing was collected,
        // but still resolve as a (partial, empty) result rather than erroring.
        if (isTargetClosedError(err)) {
          this.lastScrapeMeta = { partial: true }
          return []
        }
        throw err
      }

      const landedUrl = page.url()
      if (landedUrl.includes('/login') || landedUrl.includes('login.php')) {
        throw Object.assign(
          new Error('Not logged in to Facebook. Use "Set up Facebook Session" in the Jobs page to log in first.'),
          { code: 'FB_NOT_LOGGED_IN' }
        )
      }

      // Facebook's bot detection withholds post content from automated browsers.
      // Wait up to 3 minutes for story_message to appear — the user can interact
      // with the browser window (scroll, dismiss dialogs) to trigger rendering.
      // Once posts appear the scraper takes over automatically.
      try {
        await page.waitForSelector('[data-ad-rendering-role="story_message"]', { timeout: 180000 })
      } catch (err) {
        if (isTargetClosedError(err)) {
          this.lastScrapeMeta = { partial: true }
          return []
        }
        throw err
      }

      // ── Section 4: Infinite scroll + post collection loop ───────────────────
      const {
        maxPosts      = Infinity,
        stopAfterDate = null,
      } = pageConfig.options ?? {}

      const stopDate = stopAfterDate ? new Date(stopAfterDate) : null
      const seenIds = new Set()
      const posts = []
      let hitDateLimit = false
      let closedEarly = false

      // Consecutive iterations where NEITHER signal moved — only then do we
      // conclude the feed is exhausted. Facebook virtualizes off-screen posts
      // (removes them from the DOM), so scrollHeight can plateau for a beat
      // while new posts are still being appended below the fold; requiring
      // both signals to be flat, twice in a row, avoids stopping early on that.
      let staleRounds = 0
      const STALE_ROUNDS_LIMIT = 2

      while (seenIds.size < maxPosts && !hitDateLimit) {
        try {
          // Expand every "See more" button, re-querying after each pass — a click
          // can itself reveal a further-nested "See more" (e.g. a truncated shared
          // post inside a truncated post), so a single pass can miss them.
          const expandedTotal = await expandSeeMoreButtons(page)

          // Extract all visible post containers — skip skeletons and comments
          const postEls = await page.$$(SELECTORS.POST_CONTAINER)
          const postsBefore = posts.length
          for (const el of postEls) {
            const rawData = await extractPostData(el, pageConfig.pageId)
            if (!rawData || seenIds.has(rawData.id)) continue

            // Date-based stop: if the post has a date and it's before our cutoff, stop
            if (stopDate && rawData.date && new Date(rawData.date) < stopDate) {
              hitDateLimit = true
              break
            }

            seenIds.add(rawData.id)
            posts.push(this.normalizePost(rawData))
          }

          if (hitDateLimit) break

          const newPostsFound = posts.length > postsBefore

          // Scroll down and wait for new content to load
          const prevHeight = await page.evaluate(() => document.body.scrollHeight)
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

          // Poll for height change — bail after 5s if nothing loads
          const scrollTimeout = Date.now() + 5000
          let newHeight = prevHeight
          while (Date.now() < scrollTimeout) {
            await page.waitForTimeout(500)
            newHeight = await page.evaluate(() => document.body.scrollHeight)
            if (newHeight > prevHeight) break
          }

          // Extra settle time for new posts to finish rendering
          await page.waitForTimeout(randomDelay(800, 1500))

          const heightGrew = newHeight > prevHeight

          // Stop only once BOTH signals (scroll height, new posts captured) are
          // flat for STALE_ROUNDS_LIMIT consecutive rounds — a single flat
          // round can just mean content was still hydrating or expanding.
          if (!heightGrew && !newPostsFound && expandedTotal === 0) {
            staleRounds++
            if (staleRounds >= STALE_ROUNDS_LIMIT) break
          } else {
            staleRounds = 0
          }
        } catch (err) {
          // User closed the browser window mid-scrape — finalize with whatever
          // posts were already collected instead of losing them to the exception.
          if (isTargetClosedError(err)) {
            closedEarly = true
            break
          }
          throw err
        }
      }

      // ── Section 5: Session persists in UDD automatically — nothing extra needed

      // ── Section 6: Return normalised posts ──────────────────────────────────
      this.lastScrapeMeta = { partial: closedEarly }
      return posts
    } finally {
      await context.close().catch(() => {})
    }
  }

  // ── Public: session management ──────────────────────────────────────────────

  /**
   * Opens a visible browser window for manual Facebook login.
   * Waits for the user to complete login, then saves the session to disk.
   */
  async openLoginSession() {
    mkdirSync(this._userDataDir, { recursive: true })
    const context = await chromium.launchPersistentContext(this._userDataDir, {
      ...makeLaunchOptions(),
      slowMo: 0,
    })
    const page = await context.newPage()
    try {
      await page.goto('https://www.facebook.com/login', { waitUntil: 'domcontentloaded' })

      // Wait until the user is fully logged in — confirmed by landing on the home
      // feed (facebook.com/ or facebook.com/home*). Captcha/checkpoint pages and
      // the login page itself won't match, so we keep waiting.
      const isLoggedInUrl = (url) => {
        const s = url.toString()
        return (
          (s.startsWith('https://www.facebook.com/') || s.startsWith('https://facebook.com/')) &&
          !s.includes('/login') &&
          !s.includes('/checkpoint') &&
          !s.includes('/recover') &&
          !s.includes('/help') &&
          !s.includes('/two_step') &&
          !s.includes('/confirmemail')
        )
      }

      // Facebook's 2FA/checkpoint flow frequently chains redirects (one
      // navigation starts, then a second interrupts it before the first
      // settles). Playwright surfaces the interrupted first navigation as a
      // rejection even though the page is still open and the flow is still
      // progressing, so a single waitForURL call would tear down the session
      // on a false alarm. Retry through those specific errors, budgeting the
      // full 5 minutes across the whole login attempt rather than per-call.
      const deadline = Date.now() + 300000 // 5 minutes total for captcha + login
      while (true) {
        const timeout = deadline - Date.now()
        if (timeout <= 0) throw new Error('Timed out waiting for Facebook login to complete')

        try {
          await page.waitForURL(isLoggedInUrl, { timeout })
          break
        } catch (err) {
          if (isNavigationInterruptedError(err)) continue
          throw err
        }
      }

      // Extra wait to ensure cookies are fully flushed to the UDD
      await page.waitForTimeout(2000)

      // Write sentinel file so sessionExists() knows login has been completed.
      // The actual session lives in the UDD — launchPersistentContext persists it automatically.
      mkdirSync(dirname(this._sessionFile), { recursive: true })
      writeFileSync(this._sessionFile, JSON.stringify({ savedAt: new Date().toISOString() }))
    } finally {
      await context.close().catch(() => {})
    }
  }

  /**
   * Opens Facebook language settings in the persistent Playwright browser so the
   * user can change their account language without leaving the app.
   * The window stays open — the user closes it when done.
   */
  async openLanguageSettings() {
    mkdirSync(this._userDataDir, { recursive: true })
    const context = await chromium.launchPersistentContext(this._userDataDir, {
      ...makeLaunchOptions(),
      slowMo: 0,
    })
    const page = await context.newPage()
    await page.goto('https://www.facebook.com/settings?tab=language', {
      waitUntil: 'domcontentloaded',
    })
    // Wait indefinitely — user closes the window when done
    await page.waitForEvent('close', { timeout: 0 }).catch(() => {})
    await context.close().catch(() => {})
  }
}

// ─── Private: extract post data from a DOM element ───────────────────────────

/**
 * Extracts raw data from a single post element. Called inside the scroll loop.
 *
 * @param {import('playwright').ElementHandle} el  — the story_message element
 * @param {string} pageId
 * @returns {Promise<object|null>}
 */
async function extractPostData(el, pageId) {
  try {
    // el is the story_message element — text lives directly inside it
    const text    = await el.evaluate(node => node.innerText.trim()).catch(() => '')
    const rawHtml = await el.innerHTML().catch(() => '')

    // Permalink and date live in the post header, which is a sibling of story_message —
    // not inside it. Use el.evaluate() so `node` is the live DOM element, then
    // climb to the nearest [role="article"] ancestor via closest().
    const { href, author, rawDate } = await el.evaluate((node) => {
      // Facebook renders two different DOM structures depending on locale:
      //   Filipino/some locales: role="article" wraps the whole post card
      //   English/others:        no role="article"; uses data-ad-rendering-role siblings

      // Strategy: find the post card container, then find the timestamp <a href*="/posts/">
      // inside it. The date is either aria-label on the <a> itself (Filipino) or in the
      // element pointed to by aria-labelledby on a child span (English).

      // 1. Try role="article" first (Filipino and some locales)
      let container = node.closest('[role="article"]')

      // 2. Fall back: walk up to the first ancestor containing a /posts/ link,
      //    but stop at the first ancestor that also has profile_name (post card boundary)
      if (!container) {
        let cur = node.parentElement
        let boundary = null
        while (cur) {
          if (cur.querySelector('[data-ad-rendering-role="profile_name"]')) {
            boundary = cur
            break
          }
          cur = cur.parentElement
        }
        container = boundary
      }

      if (!container) return { href: null, author: null, date: null }

      const allLinks = [...container.querySelectorAll('a[href]')]
      const postLink = allLinks.find(a => /\/posts\/|\/permalink\/|\/reel\/|\/videos\//.test(a.href))
      const href = postLink ? postLink.href.split('?')[0] : null

      let date = null
      if (postLink) {
        // Filipino/simple: aria-label directly on the <a>
        date = postLink.getAttribute('aria-label') ?? null

        // English/scrambled: aria-labelledby on a child <span> points to a hidden element.
        // Try both innerText and aria-label on the target element.
        if (!date) {
          const tsSpan = postLink.querySelector('[aria-labelledby]')
          if (tsSpan) {
            const labelEl = document.getElementById(tsSpan.getAttribute('aria-labelledby'))
            if (labelEl) {
              date = labelEl.getAttribute('aria-label')
                  ?? labelEl.innerText?.trim()
                  ?? null
            }
          }
        }
      }

      const author = container.querySelector('[data-ad-rendering-role="profile_name"] h3 a b span, [data-ad-rendering-role="profile_name"] h3 a, h3 a b span, h3 a')?.innerText?.trim() ?? null

      return { href, author, rawDate: date }
    }).catch(() => ({ href: null, author: null, rawDate: null }))

    const date = parseFacebookDate(rawDate)
    if (rawDate && !date) console.log('[fb] unparsed date:', JSON.stringify(rawDate))
    if (!href) console.log('[fb] no url, text snippet:', text.slice(0, 60))

    // Derive stable ID: prefer permalink slug, fall back to a hash of the text
    const pfbidMatch   = href?.match(/\/posts\/(pfbid[A-Za-z0-9]+)/)
    const numericMatch = href?.match(/\/(?:posts|reel|videos)\/(\d+)/)
    let nativeId = pfbidMatch?.[1] ?? numericMatch?.[1]
    if (!nativeId) {
      let h = 5381
      for (let i = 0; i < Math.min(text.length, 200); i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
      nativeId = h.toString(36)
    }
    const id = `facebook:${pageId}:${nativeId}`

    if (!text && !rawHtml) return null

    return {
      id,
      platform: 'facebook',
      pageId,
      text,
      hashtags: extractHashtags(text),
      date,
      url:    href,
      author,
      rawHtml,
    }
  } catch {
    return null
  }
}
