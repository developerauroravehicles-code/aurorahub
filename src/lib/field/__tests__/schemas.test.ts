import { describe, expect, it } from 'vitest'
import { completeJobSchema, isOwnPhotoPath, startJobSchema } from '../schemas'
import { getBearerToken } from '@/lib/supabase/bearer'

describe('startJobSchema', () => {
  it('accepts a location with optional address', () => {
    expect(startJobSchema.safeParse({ location: { lat: 43.6, lng: -79.4, accuracyM: 12 } }).success).toBe(true)
  })
  it('rejects out-of-range coordinates', () => {
    expect(startJobSchema.safeParse({ location: { lat: 123, lng: 0 } }).success).toBe(false)
  })
})

describe('completeJobSchema', () => {
  it('requires a known service type', () => {
    const base = { location: { lat: 1, lng: 1 } }
    expect(completeJobSchema.safeParse({ ...base, serviceType: 'installation' }).success).toBe(true)
    expect(completeJobSchema.safeParse({ ...base, serviceType: 'repair' }).success).toBe(false)
  })
})

describe('isOwnPhotoPath', () => {
  it('only allows the specialist/demand folder', () => {
    expect(isOwnPhotoPath('u1/d1/a.jpg', 'u1', 'd1')).toBe(true)
    expect(isOwnPhotoPath('u2/d1/a.jpg', 'u1', 'd1')).toBe(false)
    expect(isOwnPhotoPath('u1/d2/a.jpg', 'u1', 'd1')).toBe(false)
    expect(isOwnPhotoPath('u1/d1/', 'u1', 'd1')).toBe(false)
    expect(isOwnPhotoPath('u1/d1/../d2/a.jpg', 'u1', 'd1')).toBe(false)
  })
})

describe('getBearerToken', () => {
  const req = (auth?: string) =>
    new Request('http://x', { headers: auth ? { authorization: auth } : {} })
  it('reads the token', () => expect(getBearerToken(req('Bearer abc.def'))).toBe('abc.def'))
  it('returns null when missing or malformed', () => {
    expect(getBearerToken(req())).toBeNull()
    expect(getBearerToken(req('Basic xyz'))).toBeNull()
    expect(getBearerToken(req('Bearer '))).toBeNull()
  })
})
