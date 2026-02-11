import { fromZonedTime } from 'date-fns-tz'
import { formatInTimeZone } from 'date-fns-tz'

/**
 * System default timezone: Pacific Time (PST/PDT).
 * Used when dealer timezone is not available - no UTC or server local time.
 */
export const SYSTEM_DEFAULT_TIMEZONE = 'America/Vancouver' as const

/**
 * Get effective timezone: dealer timezone if set, otherwise system default (PST).
 * Ensures we never fall back to UTC or server local.
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
