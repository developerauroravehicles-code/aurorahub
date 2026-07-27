import { formatInTimeZone, toDate } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

const WALL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Store a calendar day as noon in the dealer region so UTC never shifts the date. */
export function wallDateToAppointmentIso(ymd: string, timeZone: string): string {
  if (!WALL_DATE_RE.test(ymd)) {
    throw new Error('Invalid wall date')
  }
  const tz = timeZone.trim() || SYSTEM_DEFAULT_TIMEZONE
  const atLocalNoon = toDate(`${ymd}T12:00:00`, { timeZone: tz })
  if (Number.isNaN(atLocalNoon.getTime())) {
    throw new Error('Invalid appointment date')
  }
  return atLocalNoon.toISOString()
}

/** Read back the calendar day from a stored appointment instant. */
export function appointmentIsoToWallDate(iso: string, timeZone: string): string {
  const tz = timeZone.trim() || SYSTEM_DEFAULT_TIMEZONE
  return formatInTimeZone(new Date(iso), tz, 'yyyy-MM-dd')
}

/** External demands are date-only — no appointment time slot. */
export function formatExternalDemandDate(iso: string, timeZone: string): string {
  const tz = timeZone.trim() || SYSTEM_DEFAULT_TIMEZONE
  return formatInTimeZone(new Date(iso), tz, 'PPP')
}
