import { describe, it, expect } from 'vitest'
import { isFutureCustomer, phoneKeyDigits } from '@/lib/future-customer'
import { resolveSpecialistTemplate } from '@/lib/sms-specialist-template'
import { DEFAULT_SPECIALIST_TEMPLATE } from '@/lib/sms-settings'

describe('isFutureCustomer', () => {
  it('detects placeholder phone', () => {
    expect(isFutureCustomer({ customer_phone: '000 - 000 - 0000' })).toBe(true)
    expect(phoneKeyDigits('000 - 000 - 0000')).toBe('0000000000')
  })

  it('detects Future Customer name', () => {
    expect(isFutureCustomer({ customer_firstname: 'Future', customer_lastname: 'Customer' })).toBe(true)
  })

  it('returns false for real customers', () => {
    expect(
      isFutureCustomer({
        customer_phone: '604-833-5801',
        customer_firstname: 'JOHN',
        customer_lastname: 'DOE',
      })
    ).toBe(false)
  })
})

describe('resolveSpecialistTemplate', () => {
  it('fills vehicle and customer placeholders', () => {
    const message = resolveSpecialistTemplate(DEFAULT_SPECIALIST_TEMPLATE, {
      demand: {
        vehicle_year: 2024,
        vehicle_make: 'TOYOTA',
        vehicle_model: 'CAMRY',
        vin_last6: 'ABC123',
        stock_number: 'STK99',
        customer_firstname: 'JANE',
        customer_lastname: 'DOE',
        customer_phone: '6045551234',
      },
      dealer: { name: 'Dealer A', address: '123 Main St' },
    })
    expect(message).toContain('2024 TOYOTA CAMRY')
    expect(message).toContain('ABC123')
    expect(message).toContain('STK99')
    expect(message).toContain('JANE DOE')
    expect(message).toContain('6045551234')
    expect(message).toContain('123 Main St')
  })
})
