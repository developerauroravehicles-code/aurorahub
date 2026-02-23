import { describe, it, expect } from 'vitest'
import {
  isWithin24Hours,
  isWithin4Hours,
  isWithin4HoursBeforeWindow,
} from '../sms-messages'

describe('SMS timing utilities', () => {
  describe('isWithin24Hours', () => {
    it('returns true when appointment is within 24 hours', () => {
      const in12Hours = new Date(Date.now() + 12 * 60 * 60 * 1000)
      expect(isWithin24Hours(in12Hours)).toBe(true)
    })

    it('returns false when appointment is more than 24 hours away', () => {
      const in48Hours = new Date(Date.now() + 48 * 60 * 60 * 1000)
      expect(isWithin24Hours(in48Hours)).toBe(false)
    })

    it('returns false when appointment is in the past', () => {
      const inPast = new Date(Date.now() - 60 * 60 * 1000)
      expect(isWithin24Hours(inPast)).toBe(false)
    })

    it('returns true when appointment is exactly 1 hour away', () => {
      const in1Hour = new Date(Date.now() + 1 * 60 * 60 * 1000)
      expect(isWithin24Hours(in1Hour)).toBe(true)
    })
  })

  describe('isWithin4Hours', () => {
    it('returns true when appointment is within 4 hours', () => {
      const in2Hours = new Date(Date.now() + 2 * 60 * 60 * 1000)
      expect(isWithin4Hours(in2Hours)).toBe(true)
    })

    it('returns false when appointment is more than 4 hours away', () => {
      const in6Hours = new Date(Date.now() + 6 * 60 * 60 * 1000)
      expect(isWithin4Hours(in6Hours)).toBe(false)
    })

    it('returns false when appointment is in the past', () => {
      const inPast = new Date(Date.now() - 60 * 60 * 1000)
      expect(isWithin4Hours(inPast)).toBe(false)
    })
  })

  describe('isWithin4HoursBeforeWindow', () => {
    it('returns true when appointment is 3.5-4.5 hours away', () => {
      const in4Hours = new Date(Date.now() + 4 * 60 * 60 * 1000)
      expect(isWithin4HoursBeforeWindow(in4Hours)).toBe(true)
    })

    it('returns false when appointment is less than 3.5 hours away', () => {
      const in2Hours = new Date(Date.now() + 2 * 60 * 60 * 1000)
      expect(isWithin4HoursBeforeWindow(in2Hours)).toBe(false)
    })

    it('returns false when appointment is more than 4.5 hours away', () => {
      const in6Hours = new Date(Date.now() + 6 * 60 * 60 * 1000)
      expect(isWithin4HoursBeforeWindow(in6Hours)).toBe(false)
    })

    it('returns true at 3.6 hours', () => {
      const in3_6Hours = new Date(Date.now() + 3.6 * 60 * 60 * 1000)
      expect(isWithin4HoursBeforeWindow(in3_6Hours)).toBe(true)
    })
  })
})
