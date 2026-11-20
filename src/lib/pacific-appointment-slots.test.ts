import { describe, expect, it } from 'vitest'
import {
  appointmentMatchesPacificSlotGrid,
  buildPacificSlotIsosForDay,
  pacificAppointmentIsoFromStartMinutes,
} from './pacific-appointment-slots'
import type { DealerCalendarSettingsMap } from './dealer-calendar-day-type'

describe('pacific-appointment-slots', () => {
  it('matches global grid noon PT on 2026-11-28', () => {
    const ymd = '2026-11-28'
    const noonPt = pacificAppointmentIsoFromStartMinutes(ymd, 12 * 60)
    const grid = buildPacificSlotIsosForDay(undefined, ymd)
    expect(grid.some((iso) => new Date(iso).getTime() === new Date(noonPt).getTime())).toBe(true)
    expect(appointmentMatchesPacificSlotGrid(noonPt, undefined)).toBe(true)
  })

  it('uses friday row for saturday when saturday not configured', () => {
    const settings: DealerCalendarSettingsMap = {
      friday: {
        day_type: 'fri',
        start_hour: 9,
        start_minute: 0,
        end_hour: 16,
        end_minute: 30,
        slot_interval_minutes: 60,
        appointment_duration_minutes: 75,
      },
    }
    const ymd = '2026-11-28' // Saturday
    const onePmPt = pacificAppointmentIsoFromStartMinutes(ymd, 13 * 60)
    expect(appointmentMatchesPacificSlotGrid(onePmPt, settings)).toBe(true)
  })
})