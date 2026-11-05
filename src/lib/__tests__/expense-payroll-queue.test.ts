import { describe, expect, it } from 'vitest'
import { payPeriodForInstallmentDate, resolveNextPayableOn } from '@/lib/expense-payroll-queue'

describe('resolveNextPayableOn', () => {
  it('returns the 15th when before mid-month on semi-monthly schedule', () => {
    expect(resolveNextPayableOn('semi_monthly_equal', '2026-03-10')).toBe('2026-03-15')
  })

  it('returns month end when after the 15th on semi-monthly schedule', () => {
    expect(resolveNextPayableOn('semi_monthly_equal', '2026-03-16')).toBe('2026-03-31')
  })

  it('returns same day when already on a pay date', () => {
    expect(resolveNextPayableOn('semi_monthly_equal', '2026-03-15')).toBe('2026-03-15')
  })

  it('returns month end for monthly single schedule mid-month', () => {
    expect(resolveNextPayableOn('monthly_single', '2026-03-10')).toBe('2026-03-31')
  })
})

describe('payPeriodForInstallmentDate', () => {
  it('maps the 15th to the 1st–15th pay period', () => {
    expect(payPeriodForInstallmentDate('2026-03-15')).toEqual({
      start: '2026-03-01',
      end: '2026-03-15',
    })
  })

  it('maps month end to the 16th–last day pay period', () => {
    expect(payPeriodForInstallmentDate('2026-03-31')).toEqual({
      start: '2026-03-16',
      end: '2026-03-31',
    })
  })
})
