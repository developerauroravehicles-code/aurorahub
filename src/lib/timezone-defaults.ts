import { fromZonedTime } from 'date-fns-tz'
import { formatInTimeZone } from 'date-fns-tz'

/**
 * System base timezone: Pacific Time (America/Vancouver).
 * All system-level date/time logic (today, now, past checks, SMS logs) uses this.
 * Dealers convert for display only - if dealer is Pacific, no conversion needed.
 */
export const SYSTEM_DEFAULT_TIMEZONE = 'America/Vancouver' as const

/** Get Pacific "today" (yyyy-MM-dd) - used for past date/slot checks across the system */
export function getSystemToday(): string {
  return formatInTimeZone(new Date(), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
}

/**
 * Display timezone: dealer timezone if set, otherwise Pacific.
 * Use for formatting appointment times shown to users (dealer converts to their local time).
 */
export function getEffectiveTimezone(dealerTz: string | null | undefined): string {
  return dealerTz && dealerTz.trim() ? dealerTz : SYSTEM_DEFAULT_TIMEZONE
}

/** Format a date in HQ timezone (PT) for display in platform-level features (Service Desk, Reports, Invoice, Statement, etc.) */
export function formatInPT(date: Date | string, formatStr: string): string {
  return formatInTimeZone(typeof date === 'string' ? new Date(date) : date, SYSTEM_DEFAULT_TIMEZONE, formatStr)
}

/**
 * Convert datetime-local value (YYYY-MM-DDTHH:mm) to UTC ISO string, interpreting the value as
 * Pacific wall time (America/Vancouver). Server-safe (does not depend on the host system timezone).
 * Use for Service Desk SLA, manager note reminders, and other HQ-entered local times.
 */
export function ptDatetimeLocalToISO(localStr: string): string {
  if (!localStr || !localStr.includes('T')) return localStr
  const trimmed = localStr.trim()
  const withSeconds = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})$/.test(trimmed) ? `${trimmed}:00` : trimmed
  return fromZonedTime(withSeconds, SYSTEM_DEFAULT_TIMEZONE).toISOString()
}

/**
 * Convert yyyy-MM (e.g. "2026-03") to month range in the given timezone as ISO strings for DB queries.
 */
export function getMonthRangeInTimezone(monthStr: string, tz: string): { start: string; end: string } {
  const [y, m] = monthStr.split('-').map(Number)
  const start = fromZonedTime(new Date(y, m - 1, 1, 0, 0, 0), tz).toISOString()
  const end = fromZonedTime(new Date(y, m, 0, 23, 59, 59, 999), tz).toISOString()
  return { start, end }
}

/**
 * Convert yyyy-MM-dd date range to ISO strings in the given timezone for DB queries.
 * Ensures date filtering matches the timezone used for display (e.g. Pacific for invoices/statements).
 */
export function getDateRangeInTimezone(dateFrom: string, dateTo: string, tz: string): { start: string; end: string } {
  const [y1, m1, d1] = dateFrom.split('-').map(Number)
  const [y2, m2, d2] = dateTo.split('-').map(Number)
  const start = fromZonedTime(new Date(y1, m1 - 1, d1, 0, 0, 0), tz).toISOString()
  const end = fromZonedTime(new Date(y2, m2 - 1, d2, 23, 59, 59, 999), tz).toISOString()
  return { start, end }
}

/**
 * Get today's date range (start and end) in the given timezone as ISO strings for DB queries.
 */
export function getTodayRangeInTimezone(tz: string): { start: string; end: string } {
  const now = new Date()
  const dateStr = formatInTimeZone(now, tz, 'yyyy-MM-dd')
  const [y, mo, d] = dateStr.split('-').map(Number)
  const start = fromZonedTime(new Date(y, mo - 1, d, 0, 0, 0), tz).toISOString()
  const end = fromZonedTime(new Date(y, mo - 1, d, 23, 59, 59, 999), tz).toISOString()
  return { start, end }
}

/** Get week (Sun–Sat) and month ranges in PT for HQ date filters */
export function getPTDateRanges(): { today: { start: string; end: string }; week: { start: string; end: string }; month: { start: string; end: string } } {
  const tz = SYSTEM_DEFAULT_TIMEZONE
  const now = new Date()
  const dateStr = formatInTimeZone(now, tz, 'yyyy-MM-dd')
  const [y, mo, d] = dateStr.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(y, mo - 1, d)).getUTCDay()

  const todayStart = fromZonedTime(new Date(y, mo - 1, d, 0, 0, 0), tz).toISOString()
  const todayEnd = fromZonedTime(new Date(y, mo - 1, d, 23, 59, 59, 999), tz).toISOString()

  const weekStartY = new Date(Date.UTC(y, mo - 1, d - dayOfWeek))
  const weekEndY = new Date(Date.UTC(y, mo - 1, d - dayOfWeek + 7))
  const weekStart = fromZonedTime(new Date(weekStartY.getUTCFullYear(), weekStartY.getUTCMonth(), weekStartY.getUTCDate(), 0, 0, 0), tz).toISOString()
  const weekEnd = fromZonedTime(new Date(weekEndY.getUTCFullYear(), weekEndY.getUTCMonth(), weekEndY.getUTCDate(), 0, 0, 0), tz).toISOString()

  const monthStart = fromZonedTime(new Date(y, mo - 1, 1, 0, 0, 0), tz).toISOString()
  const monthEnd = fromZonedTime(new Date(y, mo, 0, 23, 59, 59, 999), tz).toISOString()

  return { today: { start: todayStart, end: todayEnd }, week: { start: weekStart, end: weekEnd }, month: { start: monthStart, end: monthEnd } }
}
