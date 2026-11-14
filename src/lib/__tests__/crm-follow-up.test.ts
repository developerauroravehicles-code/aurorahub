import { describe, expect, it } from 'vitest'
import { computeRemindAtFromMeeting } from '@/lib/crm/follow-up'

describe('computeRemindAtFromMeeting', () => {
  const meeting = '2026-06-15T18:00:00.000Z'

  it('subtracts 1 hour before meeting', () => {
    const d = computeRemindAtFromMeeting(meeting, 'before_1h')
    expect(d.toISOString()).toBe('2026-06-15T17:00:00.000Z')
  })

  it('adds 1 day after meeting', () => {
    const d = computeRemindAtFromMeeting(meeting, 'after_1d')
    expect(d.toISOString()).toBe('2026-06-16T18:00:00.000Z')
  })
})