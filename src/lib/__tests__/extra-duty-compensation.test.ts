import { describe, expect, it } from 'vitest'
import {
  computeExtraDutyAmount,
  computeExtraDutyHourlyRate,
  EXTRA_DUTY_MULTIPLIER,
  STANDARD_MONTHLY_HOURS,
} from '@/lib/extra-duty-compensation'

describe('computeExtraDutyHourlyRate', () => {
  it('uses monthly salary / 173.33 × 1.5 for annual HR salary', () => {
    const result = computeExtraDutyHourlyRate(54000, 'salary')
    expect('error' in result).toBe(false)
    if ('error' in result) return

    expect(result.monthlyAmount).toBe(4500)
    const expectedBase = 4500 / STANDARD_MONTHLY_HOURS
    expect(result.hourlyRate).toBeCloseTo(expectedBase * EXTRA_DUTY_MULTIPLIER, 4)
  })
})

describe('computeExtraDutyAmount', () => {
  it('computes amount for 1h 14m at 4500/month base', () => {
    const result = computeExtraDutyAmount({
      salaryAmount: 54000,
      salaryType: 'salary',
      durationMinutes: 74,
    })
    expect('error' in result).toBe(false)
    if ('error' in result) return

    const monthly = 4500
    const hourly = (monthly / STANDARD_MONTHLY_HOURS) * EXTRA_DUTY_MULTIPLIER
    const hours = 74 / 60
    const expected = Math.round(hourly * hours * 100) / 100

    expect(result.amount).toBe(expected)
    expect(result.durationMinutes).toBe(74)
    expect(result.hourlyRateUsed).toBeCloseTo(hourly, 4)
  })
})
