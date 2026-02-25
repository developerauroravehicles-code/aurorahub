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
