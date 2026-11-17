import { describe, it, expect } from 'vitest'
import { formatPhoneNumberToE164, isDemoSmsPhone } from '../twilio'

describe('Phone number formatting', () => {
  describe('formatPhoneNumberToE164', () => {
    it('formats 10-digit North American number with +1', () => {
      expect(formatPhoneNumberToE164('6048335801')).toBe('+16048335801')
      expect(formatPhoneNumberToE164('5551234567')).toBe('+15551234567')
    })

    it('handles formatted input', () => {
      expect(formatPhoneNumberToE164('(604) 833-5801')).toBe('+16048335801')
      expect(formatPhoneNumberToE164('604-833-5801')).toBe('+16048335801')
    })

    it('preserves number already in E.164 format', () => {
      const result = formatPhoneNumberToE164('+16048335801')
      expect(result).toMatch(/^\+/)
    })

    it('returns empty string for empty input', () => {
      expect(formatPhoneNumberToE164('')).toBe('')
    })
  })

  describe('isDemoSmsPhone', () => {
    it('matches +11111111… demo numbers', () => {
      expect(isDemoSmsPhone('+11111111')).toBe(true)
      expect(isDemoSmsPhone('+11111111111')).toBe(true)
      expect(isDemoSmsPhone('1111111111')).toBe(true)
    })

    it('does not match real numbers', () => {
      expect(isDemoSmsPhone('+16048335801')).toBe(false)
      expect(isDemoSmsPhone('6048335801')).toBe(false)
    })
  })
})
