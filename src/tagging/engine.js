/**
 * tagging/engine.js
 *
 * SDG tagging engine. Accepts a normalised post and returns an array of SDG
 * tag objects, each with a confidence level.
 *
 * Matching order (as specified in CLAUDE.md):
 *   1. Hashtag matching  — confidence: 'hashtag'
 *   2. Keyword matching  — confidence: 'keyword' (skips SDGs already matched)
 *
 * AI fallback is stubbed and disabled by default.
 *
 * Usage:
 *   import { buildEngine } from './engine.js'
 *   const engine = buildEngine(keywordMap)   // call once at startup
 *   const tags = engine.tagPost(post)
 */

import { SDG_METADATA } from './sdg-metadata.js'

// ─── Hashtag normalisation ────────────────────────────────────────────────────

/**
 * Normalise a hashtag for variant lookup.
 * Strips leading #, lowercases, removes spaces / underscores / dashes / &.
 * @param {string} tag
 * @returns {string}
 */
function normalizeHashtag(tag) {
  return tag
    .replace(/^#/, '')
    .toLowerCase()
    .replace(/[\s_\-&]/g, '')
}

// ─── Hashtag variant builder ──────────────────────────────────────────────────

/**
 * Build a Map of normalised hashtag variant → SDG number.
 * Called once at engine startup; never hardcodes per-SDG values.
 *
 * Patterns generated per SDG (example: SDG 3 — Good Health and Well-being):
 *   sdg3, sdg03, unsdg3, unsdg03,
 *   sdg3goodhealthandwellbeing, unsdg3goodhealthandwellbeing,
 *   goodhealthandwellbeing,
 *   goodhealth, goodhealthwellbeing, healthforall,   ← abbreviations
 *   sdg3goodhealth, unsdg3goodhealth,                ← prefixed abbreviations
 *   sdg3goodhealthwellbeing, unsdg3goodhealthwellbeing,
 *   ...
 *
 * @returns {Map<string, number>}  variant → sdgNumber
 */
function buildHashtagVariants() {
  const map = new Map()

  for (const sdg of SDG_METADATA) {
    const n = sdg.number
    const pad = String(n).padStart(2, '0')

    const variants = [
      // Number-only forms
      `sdg${n}`,
      `sdg${pad}`,
      `unsdg${n}`,
      `unsdg${pad}`,

      // Number + full slug
      `sdg${n}${sdg.slug}`,
      `unsdg${n}${sdg.slug}`,

      // Slug alone
      sdg.slug,

      // Abbreviations alone
      ...sdg.abbreviations,

      // Number + each abbreviation
      ...sdg.abbreviations.map((a) => `sdg${n}${a}`),
      ...sdg.abbreviations.map((a) => `unsdg${n}${a}`),
      ...sdg.abbreviations.map((a) => `sdg${pad}${a}`),
      ...sdg.abbreviations.map((a) => `unsdg${pad}${a}`),
    ]

    for (const v of variants) {
      // Normalise the variant itself (strip dashes etc.) before storing
      const norm = normalizeHashtag(v)
      // First writer wins — lower SDG numbers take precedence for shared slugs
      if (!map.has(norm)) map.set(norm, n)
    }
  }

  return map
}

// ─── Regex escape helper ──────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── AI fallback stub ─────────────────────────────────────────────────────────

/**
 * Stub AI fallback — disabled by default. Implement this function to call an
 * LLM or on-device classifier when hashtag + keyword matching yields no tags.
 *
 * @param {object} _post  Normalised post
 * @returns {Promise<Array>}
 */
async function aiFallback(_post) {
  // TODO: integrate AI classifier
  // Return format: [{ sdgNumber, confidence: 'ai', matchedOn: 'ai-classifier' }]
  return []
}

// ─── Engine factory ───────────────────────────────────────────────────────────

/**
 * Build a reusable tagging engine pre-loaded with the keyword map.
 *
 * @param {Map<number, Set<string>>} keywordMap  Output of loadKeywords()
 * @param {{ useAiFallback?: boolean }} [options]
 * @returns {{ tagPost: (post: object) => Promise<TagResult[]> }}
 */
export function buildEngine(keywordMap, options = {}) {
  const { useAiFallback = false } = options

  // Build hashtag variants once — O(1) lookup at tag time
  const HASHTAG_VARIANTS = buildHashtagVariants()

  /**
   * Tag a single post.
   *
   * @param {object} post  Normalised post object
   * @returns {Promise<TagResult[]>}
   *   Each result: { sdgNumber: number, confidence: 'hashtag'|'keyword'|'ai', matchedOn: string }
   */
  async function tagPost(post) {
    /** @type {Array<{ sdgNumber: number, confidence: string, matchedOn: string }>} */
    const results = []
    const taggedSdgs = new Set()

    // ── 1. Hashtag pass ────────────────────────────────────────────────────
    const hashtags = Array.isArray(post.hashtags) ? post.hashtags : []
    for (const tag of hashtags) {
      const norm = normalizeHashtag(tag)
      const sdgNumber = HASHTAG_VARIANTS.get(norm)
      if (sdgNumber != null && !taggedSdgs.has(sdgNumber)) {
        results.push({ sdgNumber, confidence: 'hashtag', matchedOn: tag })
        taggedSdgs.add(sdgNumber)
      }
    }

    // ── 2. Keyword pass ────────────────────────────────────────────────────
    // Only attempt keyword matching for SDGs not already caught by hashtag.
    const text = (post.text ?? '') + ' ' + (post.rawHtml ?? '')
    // Avoid compiling regexes inside the inner loop — pre-compile per keyword
    for (const [sdgNumber, keywords] of keywordMap) {
      if (taggedSdgs.has(sdgNumber)) continue

      for (const kw of keywords) {
        // Whole-word, case-insensitive match
        const re = new RegExp(`(?<![\\w-])${escapeRegex(kw)}(?![\\w-])`, 'i')
        if (re.test(text)) {
          results.push({ sdgNumber, confidence: 'keyword', matchedOn: kw })
          taggedSdgs.add(sdgNumber)
          break // one matching keyword per SDG is enough
        }
      }
    }

    // ── 3. AI fallback (optional) ──────────────────────────────────────────
    if (useAiFallback && results.length === 0) {
      const aiTags = await aiFallback(post)
      for (const tag of aiTags) {
        if (!taggedSdgs.has(tag.sdgNumber)) {
          results.push(tag)
          taggedSdgs.add(tag.sdgNumber)
        }
      }
    }

    return results
  }

  return { tagPost }
}
