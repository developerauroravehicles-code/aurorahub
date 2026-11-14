import { describe, expect, it } from 'vitest'
import { canSetDealerAcquired } from '@/lib/crm/acquired'

describe('canSetDealerAcquired', () => {
  it('allows set when empty', () => {
    expect(canSetDealerAcquired(null)).toBe(true)
    expect(canSetDealerAcquired(undefined)).toBe(true)
  })

  it('blocks when already set', () => {
    expect(canSetDealerAcquired('uuid-1')).toBe(false)
  })
})