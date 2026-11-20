import { getISODay } from 'date-fns'
import { formatInTimeZone, toDate } from 'date-fns-tz'
import { pad2 } from '@/lib/calendar-wall-date'
import {
  CALENDAR_DEFAULTS,
  dealerCalendarRowToSlotConfig,
  getGlobalSlotMinutes,
  getSlotMinutesFromConfig,
} from '@/lib/calendar-defaults'
import {
  resolveCalendarSettingForIsoDow,
  type DealerCalendarSettingsMap,
} from '@/lib/dealer-calendar-day-type'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

/** Slot start times (minutes from midnight) for a Pacific wall-calendar day. */
export function getSlotStartMinutesForPacificDay(
  settings: DealerCalendarSettingsMap | undefined,
  pacificDateYmd: string
): number[] {
  const isoDow = getISODay(
    toDate(`${pacificDateYmd}T12:00:00`, { timeZone: SYSTEM_DEFAULT_TIMEZONE })
  )
  const row = resolveCalendarSettingForIsoDow(settings, isoDow)
  if (row) {
    return getSlotMinutesFromConfig(dealerCalendarRowToSlotConfig(row))
  }
  return getGlobalSlotMinutes()
}

export function pacificAppointmentIsoFromStartMinutes(
  pacificDateYmd: string,
  startMinutes: number
): string {
  const h = Math.floor(startMinutes / 60)
  const m = startMinutes % 60
  const wall = `${pacificDateYmd}T${pad2(h)}:${pad2(m)}:00`
  return toDate(wall, { timeZone: SYSTEM_DEFAULT_TIMEZONE }).toISOString()
}

/** All slot start ISO strings for a Pacific calendar day (dealer grid, before blocks/capacity). */
export function buildPacificSlotIsosForDay(
  settings: DealerCalendarSettingsMap | undefined,
  pacificDateYmd: string
): string[] {
  return getSlotStartMinutesForPacificDay(settings, pacificDateYmd).map((startMinutes) =>
    pacificAppointmentIsoFromStartMinutes(pacificDateYmd, startMinutes)
  )
}

/** Parse hidden form values: UTC ISO (with Z) or Pacific wall time without offset. */
export function parseAppointmentDateInput(raw: string): Date | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/Z|[+-]\d{2}:?\d{2}$/i.test(trimmed)) {
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : d
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed
    const d = toDate(withSeconds, { timeZone: SYSTEM_DEFAULT_TIMEZONE })
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(trimmed)
  return isNaN(d.getTime()) ? null : d
}

export function canonicalPacificSlotIso(
  appointmentIso: string,
  settings: DealerCalendarSettingsMap | undefined
): string | null {
  const parsed = pacificDateAndStartMinutesFromAppointmentIso(appointmentIso)
  if (!parsed) return null
  const starts = getSlotStartMinutesForPacificDay(settings, parsed.dateStr)
  if (!starts.includes(parsed.startMinutes)) return null
  return pacificAppointmentIsoFromStartMinutes(parsed.dateStr, parsed.startMinutes)
}

export function pacificDateAndStartMinutesFromAppointmentIso(appointmentIso: string): {
  dateStr: string
  startMinutes: number
} | null {
  const t = new Date(appointmentIso)
  if (isNaN(t.getTime())) return null
  const dateStr = formatInTimeZone(t, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
  const h = Number(formatInTimeZone(t, SYSTEM_DEFAULT_TIMEZONE, 'H'))
  const m = Number(formatInTimeZone(t, SYSTEM_DEFAULT_TIMEZONE, 'm'))
  return { dateStr, startMinutes: h * 60 + m }
}

/** True when the instant matches a generated Pacific wall slot for that dealer calendar. */
export function appointmentMatchesPacificSlotGrid(
  appointmentIso: string,
  settings: DealerCalendarSettingsMap | undefined
): boolean {
  const parsed = pacificDateAndStartMinutesFromAppointmentIso(appointmentIso)
  if (!parsed) return false
  const slotIsos = buildPacificSlotIsosForDay(settings, parsed.dateStr)
  const submittedMs = new Date(appointmentIso).getTime()
  if (slotIsos.some((iso) => new Date(iso).getTime() === submittedMs)) return true
  const starts = getSlotStartMinutesForPacificDay(settings, parsed.dateStr)
  return starts.includes(parsed.startMinutes)
}

export function appointmentDurationForPacificDay(
  settings: DealerCalendarSettingsMap | undefined,
  pacificDateYmd: string
): number {
  const isoDow = getISODay(
    toDate(`${pacificDateYmd}T12:00:00`, { timeZone: SYSTEM_DEFAULT_TIMEZONE })
  )
  const row = resolveCalendarSettingForIsoDow(settings, isoDow)
  return row?.appointment_duration_minutes ?? CALENDAR_DEFAULTS.appointmentDurationMinutes
}