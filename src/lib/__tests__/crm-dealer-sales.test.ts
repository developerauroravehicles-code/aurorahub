import { describe, expect, it } from 'vitest'
import { aggregateDealerSales } from '@/lib/crm/dealer-sales'

describe('aggregateDealerSales', () => {
  it('computes share percent by invoiced amount', () => {
    const { byDealer, globalSalesTotal } = aggregateDealerSales([
      { dealer_id: 'a', invoice_total_amount: 100, completed_at: '2026-03-01', updated_at: '2026-03-01' },
      { dealer_id: 'b', invoice_total_amount: 300, completed_at: '2026-03-02', updated_at: '2026-03-02' },
      { dealer_id: 'a', invoice_total_amount: 100, completed_at: '2026-03-03', updated_at: '2026-03-03' },
    ])

    expect(globalSalesTotal).toBe(500)
    const a = byDealer.find((d) => d.dealerId === 'a')
    const b = byDealer.find((d) => d.dealerId === 'b')
    expect(a?.completedCount).toBe(2)
    expect(a?.salesTotal).toBe(200)
    expect(a?.sharePercent).toBe(40)
    expect(b?.sharePercent).toBe(60)
  })
})