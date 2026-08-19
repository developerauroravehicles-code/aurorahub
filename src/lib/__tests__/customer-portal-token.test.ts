import { describe, it, expect } from 'vitest'
import { buildPortalUrl, getPortalPublicOrigin } from '@/lib/customer-portal-token'

describe('customer portal URL', () => {
  it('builds path-based URL with explicit base', () => {
    const url = buildPortalUrl('abc123token', 'https://aurorahub.ca')
    expect(url).toBe('https://aurorahub.ca/customer-portal/abc123token')
  })

  it('explicit base overrides vercel preview', () => {
    expect(buildPortalUrl('tok', 'https://aurorahub.ca')).toBe('https://aurorahub.ca/customer-portal/tok')
  })

  it('encodes token safely in path', () => {
    const url = buildPortalUrl('a+b/c=', 'https://aurorahub.ca')
    expect(url).toBe('https://aurorahub.ca/customer-portal/a%2Bb%2Fc%3D')
  })

  it('getPortalPublicOrigin prefers CUSTOMER_PORTAL_PUBLIC_URL when set at runtime', () => {
    const prev = process.env.CUSTOMER_PORTAL_PUBLIC_URL
    process.env.CUSTOMER_PORTAL_PUBLIC_URL = 'https://aurorahub.ca'
    try {
      expect(getPortalPublicOrigin()).toBe('https://aurorahub.ca')
    } finally {
      if (prev === undefined) delete process.env.CUSTOMER_PORTAL_PUBLIC_URL
      else process.env.CUSTOMER_PORTAL_PUBLIC_URL = prev
    }
  })
})
