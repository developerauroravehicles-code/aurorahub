import { describe, expect, it } from 'vitest'
import {
  appointmentIsoToWallDate,
  formatExternalDemandDate,
  wallDateToAppointmentIso,
} from '@/lib/external-demand-date'

describe('external-demand-date', () => {
  it('round-trips a wall date in Pacific time', () => {
    const iso = wallDateToAppointmentIso('2026-07-27', 'America/Vancouver')
    expect(appointmentIsoToWallDate(iso, 'America/Vancouver')).toBe('2026-07-27')
    expect(formatExternalDemandDate(iso, 'America/Vancouver')).toContain('July 27')
  })

  it('keeps the same calendar day in another Canadian timezone', () => {
    const iso = wallDateToAppointmentIso('2026-07-27', 'America/Toronto')
    expect(appointmentIsoToWallDate(iso, 'America/Toronto')).toBe('2026-07-27')
  })

  it('does not shift the wall date when viewed from a ahead-of-UTC timezone', () => {
    const iso = wallDateToAppointmentIso('2026-07-27', 'America/Vancouver')
    expect(appointmentIsoToWallDate(iso, 'Europe/Istanbul')).toBe('2026-07-27')
  })
})
