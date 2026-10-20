import { describe, expect, it } from 'vitest'

function sumQuantities(
  balances: { location_type: string; quantity: number }[],
  locationType: string
): number {
  let total = 0
  for (const b of balances) {
    if (b.location_type !== locationType) continue
    total += b.quantity
  }
  return total
}

describe('camera stock ledger sums', () => {
  it('aggregates by location_type', () => {
    const balances = [
      { location_type: 'national', quantity: 10 },
      { location_type: 'dealer', quantity: 5 },
      { location_type: 'dealer', quantity: 3 },
      { location_type: 'specialist', quantity: 7 },
    ]
    const national = sumQuantities(balances, 'national')
    const dealer = sumQuantities(balances, 'dealer')
    const specialist = sumQuantities(balances, 'specialist')
    expect(national).toBe(10)
    expect(dealer).toBe(8)
    expect(specialist).toBe(7)
    expect(national + dealer + specialist).toBe(25)
  })
})
