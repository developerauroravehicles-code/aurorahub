import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

const RANGE_SPLIT_RE = /\s+[-–—]\s+|\s+to\s+/i

const MONTH_MAP: Record<string, number> = (() => {
  const names = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ] as const
  const m: Record<string, number> = {}
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    m[name] = i + 1
    m[name.slice(0, 3)] = i + 1
  }
  m.sept = 9
  return m
})()

function padIsoDate(y: number, mo: number, d: number): string {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Parse one side of a range like "3 March", "3 March 2026", "20 Mar".
 * Uses calendar dates (not browser timezone). English month names only.
 */
function parseDatePart(
  raw: string,
  fallbackYear: number
): { y: number; mo: number; d: number } | null {
  const t = raw.trim().replace(/\s+/g, ' ')
  const match = t.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/)
  if (!match) return null
  const d = parseInt(match[1], 10)
  const monthToken = match[2].toLowerCase()
  const mo = MONTH_MAP[monthToken]
  if (!mo || d < 1 || d > 31) return null
  const y = match[3] ? parseInt(match[3], 10) : fallbackYear
  if (y < 1990 || y > 2100) return null
  const check = new Date(y, mo - 1, d)
  if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) return null
  return { y, mo, d }
}

/**
 * Parse a manual period string, e.g. "3 March - 20 March", "3 March 2026 – 20 March 2026".
 * Returns yyyy-MM-dd bounds in calendar terms (aligned with HQ date filters).
 */
export function parseManualInvoicePeriodRange(
  input: string,
  timezone: string = SYSTEM_DEFAULT_TIMEZONE
): { start: string; end: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const parts = trimmed.split(RANGE_SPLIT_RE).map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 2) return null

  const refYear = parseInt(formatInTimeZone(new Date(), timezone, 'yyyy'), 10)

  const a = parseDatePart(parts[0], refYear)
  if (!a) return null
  const b = parseDatePart(parts[1], a.y)
  if (!b) return null

  const isoA = padIsoDate(a.y, a.mo, a.d)
  const isoB = padIsoDate(b.y, b.mo, b.d)
  if (isoB < isoA) {
    return { start: isoB, end: isoA }
  }
  return { start: isoA, end: isoB }
}

export function formatInvoicePeriodRangeDisplay(
  startIso: string,
  endIso: string,
  timezone: string = SYSTEM_DEFAULT_TIMEZONE
): string {
  const m1 = startIso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const m2 = endIso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m1 || !m2) return ''
  const y1 = parseInt(m1[1], 10)
  const mo1 = parseInt(m1[2], 10)
  const d1 = parseInt(m1[3], 10)
  const y2 = parseInt(m2[1], 10)
  const mo2 = parseInt(m2[2], 10)
  const d2 = parseInt(m2[3], 10)
  const sd = fromZonedTime(new Date(y1, mo1 - 1, d1, 12, 0, 0), timezone)
  const ed = fromZonedTime(new Date(y2, mo2 - 1, d2, 12, 0, 0), timezone)
  return `${formatInTimeZone(sd, timezone, 'd MMMM yyyy')} – ${formatInTimeZone(ed, timezone, 'd MMMM yyyy')}`
}
