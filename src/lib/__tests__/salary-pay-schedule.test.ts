import { describe, expect, it } from 'vitest'
import {
  buildSemiMonthlyInstallments,
  buildSalaryPayInstallments,
  resolveMonthlySalaryAmount,
} from '@/lib/salary-pay-schedule'

describe('resolveMonthlySalaryAmount', () => {
  it('derives monthly from annual salary', () => {
    expect(resolveMonthlySalaryAmount(54000, 'salary')).toBe(4500)
  })
})

describe('buildSemiMonthlyInstallments', () => {
  it('splits monthly amount 50/50 on 15th and last day', () => {
    const rows = buildSemiMonthlyInstallments(4500, 2026, 3)
    expect(rows).toHaveLength(2)
    expect(rows[0].dueDate).toBe('2026-03-15')
    expect(rows[0].amount).toBe(2250)
    expect(rows[1].dueDate).toBe('2026-03-31')
    expect(rows[1].amount).toBe(2250)
    expect(rows[0].amount + rows[1].amount).toBe(4500)
  })

  it('handles odd cents on second installment', () => {
    const rows = buildSemiMonthlyInstallments(4500.01, 2026, 1)
    expect(rows[0].amount + rows[1].amount).toBeCloseTo(4500.01, 2)
  })
})

describe('buildSalaryPayInstallments', () => {
  it('uses annual HR salary for semi-monthly schedule', () => {
    const rows = buildSalaryPayInstallments({
      salaryAmount: 54000,
      salaryType: 'salary',
      paySchedule: 'semi_monthly_equal',
      year: 2026,
      month1to12: 10,
    })
    expect(rows[0].amount).toBe(2250)
    expect(rows[1].amount).toBe(2250)
  })
})
