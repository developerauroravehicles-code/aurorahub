import { describe, expect, it } from 'vitest'
import {
  mapSalaryFieldsToCompensation,
  prorateAnnualSalaryToPeriod,
} from '@/lib/personnel-compensation'
import { computeSpecialistPayEstimate, SPECIALIST_RATES } from '@/lib/specialist-compensation'

describe('prorateAnnualSalaryToPeriod', () => {
  it('prorates full calendar month of non-leap year', () => {
    const amount = prorateAnnualSalaryToPeriod(120000, '2025-03-01', '2025-03-31')
    expect(amount).toBeCloseTo(120000 * (31 / 365), 1)
  })
})

describe('mapSalaryFieldsToCompensation', () => {
  it('maps annual salary to fixed period pay', () => {
    const resolved = mapSalaryFieldsToCompensation(65000, 'salary', '2025-10-01', '2025-10-31')
    expect(resolved?.payMode).toBe('fixed_period')
    expect(resolved?.annualSalaryCad).toBe(65000)
    expect(resolved?.fixedPeriodPayCad).toBeGreaterThan(0)
  })

  it('maps per installation to flat rate', () => {
    const resolved = mapSalaryFieldsToCompensation(85, 'per_installation', '2025-10-01', '2025-10-31')
    expect(resolved?.payMode).toBe('flat_per_installation')
    expect(resolved?.perInstallationCad).toBe(85)
  })
})

describe('computeSpecialistPayEstimate with HR compensation', () => {
  it('uses flat per-installation amount from HR', () => {
    const comp = mapSalaryFieldsToCompensation(100, 'per_installation', '2025-10-01', '2025-10-31')!
    const result = computeSpecialistPayEstimate({
      installationsCompleted: 4,
      removalsCompleted: 0,
      transfersCompleted: 0,
      delay30minCount: 0,
      delay60minCount: 0,
      serviceFeeTotal: 0,
      expenseReimbTotal: 0,
      expenseClaims: [],
      manualItems: [],
      rates: SPECIALIST_RATES,
      compensation: comp,
    })
    expect(result.estimated_net_cad).toBe(400)
    expect(result.pay_lines.find((l) => l.id === 'installations')?.amount).toBe(400)
  })

  it('includes prorated salary line for annual HR salary', () => {
    const comp = mapSalaryFieldsToCompensation(120000, 'salary', '2025-10-01', '2025-10-31')!
    const result = computeSpecialistPayEstimate({
      installationsCompleted: 0,
      removalsCompleted: 0,
      transfersCompleted: 0,
      delay30minCount: 0,
      delay60minCount: 0,
      serviceFeeTotal: 0,
      expenseReimbTotal: 0,
      expenseClaims: [],
      manualItems: [],
      compensation: comp,
    })
    expect(result.pay_lines.find((l) => l.id === 'base-salary')?.amount).toBe(comp.fixedPeriodPayCad)
    expect(result.estimated_net_cad).toBe(comp.fixedPeriodPayCad)
  })
})
