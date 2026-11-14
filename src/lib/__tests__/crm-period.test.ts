import { describe, expect, it } from 'vitest'
import { crmPeriodIsoBounds, resolveCrmPeriod } from '@/lib/crm/period'

describe('resolveCrmPeriod', () => {
  it('builds Q2 date range', () => {
    const p = resolveCrmPeriod(2026, 2)
    expect(p.dateFrom).toBe('2026-04-01')
    expect(p.dateTo).toBe('2026-06-30')
    expect(p.label).toBe('2026 Q2')
  })

  it('builds full year', () => {
    const p = resolveCrmPeriod(2026, 'all')
    expect(p.dateFrom).toBe('2026-01-01')
    expect(p.dateTo).toBe('2026-12-31')
  })
})

describe('crmPeriodIsoBounds', () => {
  it('returns ISO bounds for Q1 in Pacific', () => {
    const p = resolveCrmPeriod(2026, 1)
    const { startIso, endIso } = crmPeriodIsoBounds(p)
    expect(startIso).toMatch(/^2026-01-01/)
    expect(endIso.length).toBeGreaterThan(10)
  })
})