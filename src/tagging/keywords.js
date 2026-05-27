/**
 * tagging/keywords.js
 *
 * Loads and parses the SDG keyword list from keywords.xlsx, returning a Map
 * of sdgNumber → Set<string> (all lowercase, expanded).
 *
 * Sheet structure expected:
 *   Sheet name : "Compiled SDG Keywords"
 *   Row 1      : headers, e.g. "SDG 1", "SDG 2", "SDG3" (parsed loosely)
 *   Rows 2+    : keywords, one per cell, variable length per column
 *
 * Expansion rules applied at load time:
 *   1. Slash variants  — "Child labor/labour" → ["Child labor", "Child labour"]
 *                        "effect/s"           → ["effect", "effects"]
 *   2. British/American spelling pairs — both directions added automatically
 *   3. Everything normalised to lowercase for matching
 */

import XLSX from 'xlsx'
import { join } from 'path'

// ─── British ↔ American spelling pairs ───────────────────────────────────────
// Each pair is [british, american]. Both variants are added when either appears.
const SPELLING_PAIRS = [
  ['organisation', 'organization'],
  ['organisations', 'organizations'],
  ['organisational', 'organizational'],
  ['industrialisation', 'industrialization'],
  ['industrialised', 'industrialized'],
  ['industrialise', 'industrialize'],
  ['behaviour', 'behavior'],
  ['behaviours', 'behaviors'],
  ['labour', 'labor'],
  ['centre', 'center'],
  ['centres', 'centers'],
  ['colour', 'color'],
  ['colours', 'colors'],
  ['programme', 'program'],
  ['programmes', 'programs'],
  ['recognise', 'recognize'],
  ['recognises', 'recognizes'],
  ['recognising', 'recognizing'],
  ['realise', 'realize'],
  ['realises', 'realizes'],
  ['realising', 'realizing'],
  ['analyse', 'analyze'],
  ['analyses', 'analyzes'],
  ['analysing', 'analyzing'],
  ['catalogue', 'catalog'],
  ['catalogues', 'catalogs'],
  ['defence', 'defense'],
  ['licence', 'license'],
  ['licences', 'licenses'],
  ['favour', 'favor'],
  ['favours', 'favors'],
  ['honour', 'honor'],
  ['honours', 'honors'],
  ['practise', 'practice'],
  ['practises', 'practices'],
  ['fulfil', 'fulfill'],
  ['fulfils', 'fulfills'],
  ['fulfilment', 'fulfillment'],
  ['enrolment', 'enrollment'],
  ['enrol', 'enroll'],
  ['modelling', 'modeling'],
  ['travelling', 'traveling'],
  ['well-being', 'wellbeing'],
]

// Pre-build lookup maps for O(1) pair resolution
const BRIT_TO_AMER = new Map(SPELLING_PAIRS.map(([b, a]) => [b, a]))
const AMER_TO_BRIT = new Map(SPELLING_PAIRS.map(([b, a]) => [a, b]))

// ─── Slash variant expansion ──────────────────────────────────────────────────

/**
 * Expand a keyword containing slash notation into multiple keywords.
 *
 * Cases:
 *   "Child labor/labour"       → ["Child labor", "Child labour"]
 *   "Distributional effect/s"  → ["Distributional effect", "Distributional effects"]
 *   "Co-op/cooperative"        → ["Co-op", "cooperative"]
 *   "No slashes here"          → ["No slashes here"]
 *
 * @param {string} keyword
 * @returns {string[]}
 */
function expandSlashVariants(keyword) {
  if (!keyword.includes('/')) return [keyword]

  // Find the token that contains the slash
  const tokens = keyword.split(' ')
  const slashIdx = tokens.findIndex((t) => t.includes('/'))
  if (slashIdx === -1) return [keyword]

  const slashToken = tokens[slashIdx]
  const slashPos = slashToken.indexOf('/')
  const before = slashToken.slice(0, slashPos)
  const after = slashToken.slice(slashPos + 1)

  // Case: "effect/s" — the part after the slash is a suffix (no spaces, short)
  // Heuristic: if after-part has no vowels or is <= 2 chars, treat as suffix
  const isSuffix = after.length <= 3 && !/[aeiou]/i.test(after)

  let variants
  if (isSuffix) {
    // e.g. "effect/s" → ["effect", "effects"]
    variants = [before, before + after]
  } else {
    // e.g. "labor/labour" → ["labor", "labour"]
    variants = [before, after]
  }

  return variants.map((v) => {
    const newTokens = [...tokens]
    newTokens[slashIdx] = v
    return newTokens.join(' ')
  })
}

// ─── Spelling expansion ───────────────────────────────────────────────────────

/**
 * Given a keyword (already lowercased), return an array containing the
 * original plus any spelling variant (British ↔ American). Uses word-level
 * replacement to handle compound phrases.
 *
 * @param {string} kw  Lowercased keyword
 * @returns {string[]}
 */
function expandSpellingVariants(kw) {
  const variants = new Set([kw])

  // Split on word boundaries to check each word
  const words = kw.split(/\b/)
  let changed = false
  const altWords = words.map((w) => {
    if (BRIT_TO_AMER.has(w)) { changed = true; return BRIT_TO_AMER.get(w) }
    if (AMER_TO_BRIT.has(w)) { changed = true; return AMER_TO_BRIT.get(w) }
    return w
  })
  if (changed) variants.add(altWords.join(''))

  return [...variants]
}

// ─── Main loader ──────────────────────────────────────────────────────────────

/**
 * Load and parse the keywords.xlsx file.
 *
 * @param {string} [xlsxPath]  Optional override path (for testing)
 * @returns {Map<number, Set<string>>}  sdgNumber (1–17) → Set of lowercase keywords
 */
export function loadKeywords(xlsxPath) {
  // __dirname is injected by electron-vite → points to out/main/ at runtime.
  // keywords.xlsx is copied there by the vite copy plugin.
  const filePath = xlsxPath ?? join(__dirname, 'keywords.xlsx')

  const workbook = XLSX.readFile(filePath)

  const SHEET_NAME = 'Compiled SDG Keywords'
  const sheet = workbook.Sheets[SHEET_NAME]
  if (!sheet) {
    const available = workbook.SheetNames.join(', ')
    throw new Error(
      `Sheet "${SHEET_NAME}" not found in keywords.xlsx. Available sheets: ${available}`
    )
  }

  // Get raw 2-D array — header: 1 means first row becomes index 0 of each row array
  // We use header: 1 to preserve column positions, then handle headers ourselves.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

  if (!rows.length) throw new Error('keywords.xlsx sheet is empty')

  const headerRow = rows[0]
  const dataRows = rows.slice(1)

  // Map column index → SDG number by parsing header values
  // Accept formats: "SDG 1", "SDG1", "SDG 01", "SDG01", "1"
  const colToSdg = new Map()
  headerRow.forEach((header, colIdx) => {
    if (header == null) return
    const match = String(header).match(/\b(\d{1,2})\b/)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n >= 1 && n <= 17) colToSdg.set(colIdx, n)
    }
  })

  // Build the result map, initialising Sets for all 17 SDGs
  const keywordMap = new Map()
  for (let i = 1; i <= 17; i++) keywordMap.set(i, new Set())

  // Iterate columns → SDGs, then rows → keywords per column
  for (const [colIdx, sdgNumber] of colToSdg) {
    const kwSet = keywordMap.get(sdgNumber)

    for (const row of dataRows) {
      const cell = row[colIdx]
      if (cell == null || String(cell).trim() === '') continue // stop at empty

      const raw = String(cell).trim()

      // Step 1: expand slash variants
      const slashExpanded = expandSlashVariants(raw)

      // Step 2: normalise to lowercase + expand spelling variants
      for (const variant of slashExpanded) {
        const lower = variant.toLowerCase()
        const spellingExpanded = expandSpellingVariants(lower)
        for (const kw of spellingExpanded) {
          kwSet.add(kw)
        }
      }
    }
  }

  return keywordMap
}
