/** ISO day-of-week (date-fns getISODay): 1 = Monday … 7 = Sunday */
export const ISO_WEEKDAY_LABELS: { isoDow: number; label: string; short: string }[] = [
  { isoDow: 1, label: 'Monday', short: 'Mon' },
  { isoDow: 2, label: 'Tuesday', short: 'Tue' },
  { isoDow: 3, label: 'Wednesday', short: 'Wed' },
  { isoDow: 4, label: 'Thursday', short: 'Thu' },
  { isoDow: 5, label: 'Friday', short: 'Fri' },
  { isoDow: 6, label: 'Saturday', short: 'Sat' },
  { isoDow: 7, label: 'Sunday', short: 'Sun' },
]

export const DEALER_CALENDAR_DAY_TYPES = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'saturday',
  'sunday',
] as const

export type DealerCalendarDayType = (typeof DEALER_CALENDAR_DAY_TYPES)[number]

export type DealerCalendarSettingRow = {
  day_type: string
  start_hour: number
  end_hour: number
  slot_interval_minutes: number
  appointment_duration_minutes: number
}

export type DealerCalendarSettingsMap = Partial<
  Record<DealerCalendarDayType | 'weekday', DealerCalendarSettingRow>
>

export function isoDowToDayType(isoDow: number): DealerCalendarDayType {
  const map: DealerCalendarDayType[] = [
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'saturday',
    'sunday',
  ]
  return map[isoDow - 1] ?? 'mon'
}

export function dayTypeToIsoDow(dayType: DealerCalendarDayType): number {
  const idx = DEALER_CALENDAR_DAY_TYPES.indexOf(dayType)
  return idx >= 0 ? idx + 1 : 1
}

export function buildCalendarSettingsMap(
  rows: DealerCalendarSettingRow[]
): DealerCalendarSettingsMap {
  const out: DealerCalendarSettingsMap = {}
  for (const row of rows) {
    const dt = row.day_type as DealerCalendarDayType | 'weekday'
    if (
      dt === 'weekday' ||
      (DEALER_CALENDAR_DAY_TYPES as readonly string[]).includes(dt)
    ) {
      out[dt] = row
    }
  }
  return out
}

/** Resolve hours for an ISO weekday; Mon–Fri fall back to legacy `weekday` row if per-day not set. */
export function resolveCalendarSettingForIsoDow(
  settings: DealerCalendarSettingsMap | undefined,
  isoDow: number
): DealerCalendarSettingRow | undefined {
  if (!settings) return undefined
  const dayType = isoDowToDayType(isoDow)
  const specific = settings[dayType]
  if (specific) return specific
  if (isoDow >= 1 && isoDow <= 5) return settings.weekday
  return undefined
}

export function isIsoDowClosed(
  closedIsoDays: number[] | Set<number> | undefined,
  isoDow: number
): boolean {
  if (!closedIsoDays) return false
  if (closedIsoDays instanceof Set) return closedIsoDays.has(isoDow)
  return closedIsoDays.includes(isoDow)
}
