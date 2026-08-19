import { describe, expect, it } from 'vitest'
import { computeSpecialistPayEstimate, SPECIALIST_RATES } from '@/lib/specialist-compensation'

describe('computeSpecialistPayEstimate', () => {
  it('uses HR tier rates when provided', () => {
    const result = computeSpecialistPayEstimate({
      installationsCompleted: 3,
      removalsCompleted: 0,
      transfersCompleted: 1,
      delay30minCount: 0,
      delay60minCount: 0,
      serviceFeeTotal: 0,
      expenseReimbTotal: 0,
      expenseClaims: [],
      manualItems: [],
      rates: {
        ...SPECIALIST_RATES,
        baseCompleted: 10,
        baseAmountCad: 2500,
        perExtraCad: 75,
        transferCad: 100,
      },
    })

    expect(result.estimated_net_cad).toBe(2600)
    expect(result.rates_used.baseAmountCad).toBe(2500)
    expect(result.pay_lines.find((l) => l.id === 'installations')?.amount).toBe(2500)
    expect(result.pay_lines.find((l) => l.id === 'transfers')?.amount).toBe(100)
  })

  it('falls back to default rates', () => {
    const result = computeSpecialistPayEstimate({
      installationsCompleted: 16,
      removalsCompleted: 0,
      transfersCompleted: 0,
      delay30minCount: 0,
      delay60minCount: 0,
      serviceFeeTotal: 0,
      expenseReimbTotal: 0,
      expenseClaims: [],
      manualItems: [],
    })

    expect(result.estimated_net_cad).toBe(2050)
    expect(result.rates_used).toEqual(SPECIALIST_RATES)
  })
})
