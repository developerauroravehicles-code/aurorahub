import { describe, it, expect } from 'vitest'
import { DEFAULT_SMS_SETTINGS, SMS_PLACEHOLDERS } from '../sms-settings'

describe('SMS Settings', () => {
  describe('DEFAULT_SMS_SETTINGS', () => {
    it('has all required trigger types', () => {
      expect(DEFAULT_SMS_SETTINGS.appointment_created).toBeDefined()
      expect(DEFAULT_SMS_SETTINGS.cancellation_notice).toBeDefined()
      expect(DEFAULT_SMS_SETTINGS.rescheduling_notice).toBeDefined()
      expect(DEFAULT_SMS_SETTINGS.four_hour_reminder).toBeDefined()
    })

    it('appointment_created has sendToCustomer and sendToSpecialist', () => {
      expect(DEFAULT_SMS_SETTINGS.appointment_created.sendToCustomer).toBe(true)
      expect(DEFAULT_SMS_SETTINGS.appointment_created.sendToSpecialist).toBe(true)
      expect(DEFAULT_SMS_SETTINGS.appointment_created.enabled).toBe(true)
    })

    it('templates contain expected placeholders', () => {
      expect(DEFAULT_SMS_SETTINGS.appointment_created.template).toContain('{{date}}')
      expect(DEFAULT_SMS_SETTINGS.appointment_created.template).toContain('{{address}}')
      expect(DEFAULT_SMS_SETTINGS.cancellation_notice.template).toContain('{{phone}}')
      expect(DEFAULT_SMS_SETTINGS.four_hour_reminder.template).toContain('{{hours}}')
    })

    it('has contactPhone and signature', () => {
      expect(DEFAULT_SMS_SETTINGS.contactPhone).toBeTruthy()
      expect(DEFAULT_SMS_SETTINGS.signature).toBe('Aurora Vehicles.')
    })
  })

  describe('SMS_PLACEHOLDERS', () => {
    it('defines all template placeholders', () => {
      expect(SMS_PLACEHOLDERS['{{date}}']).toBeDefined()
      expect(SMS_PLACEHOLDERS['{{address}}']).toBeDefined()
      expect(SMS_PLACEHOLDERS['{{hours}}']).toBeDefined()
      expect(SMS_PLACEHOLDERS['{{phone}}']).toBeDefined()
      expect(SMS_PLACEHOLDERS['{{signature}}']).toBeDefined()
    })
  })
})
