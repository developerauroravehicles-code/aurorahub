import { describe, expect, it } from 'vitest'
import { APPOINTMENT_DURATION_MINUTES, countOverlapsAtSlot } from '@/lib/scheduling-pool'

describe('scheduling-pool', () => {
  it('counts overlapping appointments at a slot', () => {
    const slotStart = Date.parse('2026-08-27T17:30:00.000Z')
    const slotEnd = slotStart + APPOINTMENT_DURATION_MINUTES * 60 * 1000
    const appointments = [
      { appointment_date: '2026-08-27T17:30:00.000Z' },
      { appointment_date: '2026-08-27T17:30:00.000Z' },
      { appointment_date: '2026-08-27T21:00:00.000Z' },
    ]
    expect(countOverlapsAtSlot(slotStart, slotEnd, appointments)).toBe(2)
  })

  it('treats slot as available when overlap count is below capacity', () => {
    const slotStart = Date.parse('2026-08-27T17:30:00.000Z')
    const slotEnd = slotStart + APPOINTMENT_DURATION_MINUTES * 60 * 1000
    const appointments = [{ appointment_date: '2026-08-27T17:30:00.000Z' }]
    const capacity = 2
    expect(countOverlapsAtSlot(slotStart, slotEnd, appointments)).toBeLessThan(capacity)
  })

  it('treats slot as fully booked when overlap count reaches capacity', () => {
    const slotStart = Date.parse('2026-08-27T17:30:00.000Z')
    const slotEnd = slotStart + APPOINTMENT_DURATION_MINUTES * 60 * 1000
    const appointments = [
      { appointment_date: '2026-08-27T17:30:00.000Z' },
      { appointment_date: '2026-08-27T17:30:00.000Z' },
    ]
    const capacity = 2
    expect(countOverlapsAtSlot(slotStart, slotEnd, appointments)).toBeGreaterThanOrEqual(capacity)
  })
})
