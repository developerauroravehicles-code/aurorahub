import { describe, it, expect } from 'vitest'
import {
  resolveAppointmentCreatedTemplate,
  resolveCancellationTemplate,
  resolveReminderTemplate,
} from '../sms-resolver'

describe('Template resolvers', () => {
  describe('resolveAppointmentCreatedTemplate', () => {
    it('replaces {{date}}, {{address}}, {{signature}} placeholders', () => {
      const template = 'Appointment on {{date}} at {{address}}. {{signature}}'
      const appointmentDate = new Date('2026-02-15T14:30:00Z')
      const result = resolveAppointmentCreatedTemplate(template, {
        appointmentDate,
        address: '123 Main St',
        signature: 'Aurora Vehicles.',
      })
      expect(result).toContain('123 Main St')
      expect(result).toContain('Aurora Vehicles.')
      expect(result).not.toContain('{{date}}')
      expect(result).not.toContain('{{address}}')
      expect(result).not.toContain('{{signature}}')
    })

    it('formats date in AM/PM format', () => {
      const template = '{{date}}'
      const appointmentDate = new Date('2026-02-15T14:30:00Z')
      const result = resolveAppointmentCreatedTemplate(template, {
        appointmentDate,
        address: '',
        signature: '',
      })
      expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/)
    })
  })

  describe('resolveCancellationTemplate', () => {
    it('replaces {{phone}} and {{signature}}', () => {
      const template = 'Call {{phone}}. {{signature}}'
      const result = resolveCancellationTemplate(template, {
        phone: '(604) 833-5801',
        signature: 'Aurora Vehicles.',
      })
      expect(result).toBe('Call (604) 833-5801. Aurora Vehicles.')
    })

    it('handles multiple occurrences', () => {
      const template = '{{phone}} or {{phone}}'
      const result = resolveCancellationTemplate(template, {
        phone: '555-1234',
        signature: '',
      })
      expect(result).toBe('555-1234 or 555-1234')
    })
  })

  describe('resolveReminderTemplate', () => {
    it('replaces {{hours}}, {{address}}, {{signature}}', () => {
      const template = 'In {{hours}} at {{address}}. {{signature}}'
      const result = resolveReminderTemplate(template, {
        hoursText: '4 hours',
        address: '456 Oak Ave',
        signature: 'Aurora Vehicles.',
      })
      expect(result).toBe('In 4 hours at 456 Oak Ave. Aurora Vehicles.')
    })

    it('handles singular hour', () => {
      const template = '{{hours}}'
      const result = resolveReminderTemplate(template, {
        hoursText: '1 hour',
        address: '',
        signature: '',
      })
      expect(result).toBe('1 hour')
    })
  })
})
