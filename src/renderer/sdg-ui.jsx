/**
 * renderer/sdg-ui.jsx
 *
 * Shared SDG display constants and components used across Dashboard,
 * Results, and any future pages.
 *
 * Official SDG names sourced from: https://sdgs.un.org/goals
 * Official SDG colours from the UN SDG brand guidelines.
 */

import { SDG_METADATA } from '../tagging/sdg-metadata.js'

// ─── Official UN SDG colours ──────────────────────────────────────────────────

export const SDG_COLORS = {
  1:  '#E5243B',
  2:  '#DDA63A',
  3:  '#4C9F38',
  4:  '#C5192D',
  5:  '#FF3A21',
  6:  '#26BDE2',
  7:  '#FCC30B',
  8:  '#A21942',
  9:  '#FD6925',
  10: '#DD1367',
  11: '#FD9D24',
  12: '#BF8B2E',
  13: '#3F7E44',
  14: '#0A97D9',
  15: '#56C02B',
  16: '#00689D',
  17: '#19486A',
}

// ─── Official short names (as printed on the UN SDG icon wheel) ───────────────

export const SDG_SHORT_NAMES = {
  1:  'No Poverty',
  2:  'Zero Hunger',
  3:  'Good Health and Well-Being',
  4:  'Quality Education',
  5:  'Gender Equality',
  6:  'Clean Water and Sanitation',
  7:  'Affordable and Clean Energy',
  8:  'Decent Work and Economic Growth',
  9:  'Industry, Innovation and Infrastructure',
  10: 'Reduced Inequalities',
  11: 'Sustainable Cities and Communities',
  12: 'Responsible Consumption and Production',
  13: 'Climate Action',
  14: 'Life Below Water',
  15: 'Life on Land',
  16: 'Peace, Justice and Strong Institutions',
  17: 'Partnerships for the Goals',
}

// Full official names derived from sdg-metadata.js (same as short names for SDGs)
export const SDG_FULL_NAMES = Object.fromEntries(
  SDG_METADATA.map(s => [s.number, s.name])
)

// ─── SdgBadge ─────────────────────────────────────────────────────────────────
// Coloured square badge showing the SDG number.
// Tooltip always shows the full official name.

/**
 * @param {{ number: number, size?: 'sm' | 'md' }} props
 */
export function SdgBadge({ number, size = 'md' }) {
  const color = SDG_COLORS[number] ?? '#3B82F6'
  const name  = SDG_SHORT_NAMES[number] ?? `SDG ${number}`
  const dim   = size === 'sm' ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'
  return (
    <span
      className={`inline-flex items-center justify-center ${dim} rounded font-bold text-white shrink-0 cursor-default`}
      style={{ backgroundColor: color }}
      title={`SDG ${number}: ${name}`}
      aria-label={`SDG ${number}: ${name}`}
    >
      {number}
    </span>
  )
}

// ─── SdgPill ──────────────────────────────────────────────────────────────────
// Toggle pill used in filter rows.
// Inactive: compact number-only square.
// Active: expands to show number + official short name.

/**
 * @param {{ number: number, active: boolean, onClick: (n: number) => void }} props
 */
export function SdgPill({ number, active, onClick }) {
  const color = SDG_COLORS[number] ?? '#3B82F6'
  const name  = SDG_SHORT_NAMES[number] ?? `SDG ${number}`
  return (
    <button
      onClick={() => onClick(number)}
      aria-pressed={active}
      title={`SDG ${number}: ${name}`}
      className={[
        'inline-flex items-center gap-1 rounded text-xs font-bold transition-all duration-150 cursor-pointer border',
        active
          ? 'text-white border-transparent shadow-md px-2 py-1'
          : 'justify-center w-8 h-8 text-slate-400 bg-slate-800 border-slate-700 hover:border-slate-500 hover:text-slate-200',
      ].join(' ')}
      style={active ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {active ? (
        <>
          <span>{number}</span>
          <span className="font-normal text-white/80 text-[11px] whitespace-nowrap">{name}</span>
        </>
      ) : number}
    </button>
  )
}
