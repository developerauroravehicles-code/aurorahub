/**
 * Shared Pacific (PT) slot grid per scheduling pool.
 * Dealers in the same pool share capacity (= specialist count in that pool).
 * Different pools (e.g. distant service areas) book independently.
 */

export const CALENDAR_DEFAULTS = {
  /** Start hour (0-23) */
  startHour: 9,
  /** Start minute */
  startMinute: 0,
  /** End hour (0-23) - last slot must end by this time */
  endHour: 16,
  /** End minute */
  endMinute: 30,
  /** Minutes between slot start times */
  slotIntervalMinutes: 90,
  /** Appointment duration in minutes */
  appointmentDurationMinutes: 75,
} as const

/** End of day in minutes from midnight (for last slot check) */
export function getEndMinutesFromMidnight(): number {
  return CALENDAR_DEFAULTS.endHour * 60 + CALENDAR_DEFAULTS.endMinute
}

/**
 * Generate slot start times (in minutes from midnight) for the single global calendar.
 * Used for both demand form and calendar block UI. Same logic everywhere.
 */
export function getGlobalSlotMinutes(): number[] {
  const { startHour, startMinute, slotIntervalMinutes, appointmentDurationMinutes } = CALENDAR_DEFAULTS
  const endMinutes = getEndMinutesFromMidnight()
  const lastStartMinutes = endMinutes - appointmentDurationMinutes
  const slots: number[] = []
  let current = startHour * 60 + startMinute
  while (current <= lastStartMinutes) {
    slots.push(current)
    current += slotIntervalMinutes
  }
  return slots
}

export interface SlotConfig {
  startHour: number
  endHour: number
  endMinute?: number
  slotIntervalMinutes: number
  appointmentDurationMinutes: number
}

/**
 * Generate slot start times (minutes from midnight) for given config.
 * Used when dealer has custom hours (dealer_calendar_settings).
 */
export function getSlotMinutesFromConfig(config: SlotConfig): number[] {
  const endMin = config.endMinute ?? 0
  const endMinutes = config.endHour * 60 + endMin
  const lastStartMinutes = endMinutes - config.appointmentDurationMinutes
  const slots: number[] = []
  let current = config.startHour * 60
  while (current <= lastStartMinutes) {
    slots.push(current)
    current += config.slotIntervalMinutes
  }
  return slots
}
