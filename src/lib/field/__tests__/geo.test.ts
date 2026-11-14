import { describe, expect, it } from 'vitest'
import { distanceMeters, evaluateProof, FIELD_DISTANCE_THRESHOLD_M } from '../geo'

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters({ lat: 43.65, lng: -79.38 }, { lat: 43.65, lng: -79.38 })).toBe(0)
  })

  it('matches a known distance (~111 km per degree of latitude)', () => {
    const d = distanceMeters({ lat: 43, lng: -79 }, { lat: 44, lng: -79 })
    expect(d).toBeGreaterThan(111_000)
    expect(d).toBeLessThan(111_400)
  })
})

describe('evaluateProof', () => {
  const address = { lat: 43.6532, lng: -79.3832 }

  it('is not suspicious near the address', () => {
    const r = evaluateProof({ lat: 43.6535, lng: -79.3832 }, address)
    expect(r.suspicious).toBe(false)
    expect(r.distanceM).toBeLessThan(FIELD_DISTANCE_THRESHOLD_M)
  })

  it('is suspicious beyond the threshold', () => {
    const r = evaluateProof({ lat: 43.66, lng: -79.3832 }, address)
    expect(r.suspicious).toBe(true)
    expect(r.distanceM).toBeGreaterThan(FIELD_DISTANCE_THRESHOLD_M)
  })

  it('is suspicious when the address could not be geocoded', () => {
    expect(evaluateProof({ lat: 43.65, lng: -79.38 }, null)).toEqual({ distanceM: null, suspicious: true })
  })
})
