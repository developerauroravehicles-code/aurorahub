import { describe, it, expect } from 'vitest'
import { formatPhoneNumberToE164 } from '../twilio'

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
})
