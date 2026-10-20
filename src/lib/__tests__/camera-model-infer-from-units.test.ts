import { describe, expect, it } from 'vitest'
import { scannedUnitsMatchSetTemplate } from '@/lib/camera-model-infer-from-units'
import { normalizeCameraModelLookupKey } from '@/lib/camera-model-resolve'

describe('normalizeCameraModelLookupKey', () => {
  it('strips Set prefix and normalizes spacing', () => {
    expect(normalizeCameraModelLookupKey('Set — Aurora Nova + Battery')).toBe('aurora nova + battery')
    expect(normalizeCameraModelLookupKey('  Aurora   Nova  ')).toBe('aurora nova')
  })
})

describe('scannedUnitsMatchSetTemplate', () => {
  it('matches multiset of component ids', () => {
    const items = [
      { camera_model_id: 'nova', quantity: 1 },
      { camera_model_id: 'battery', quantity: 1 },
    ]
    expect(scannedUnitsMatchSetTemplate(['nova', 'battery'], items)).toBe(true)
    expect(scannedUnitsMatchSetTemplate(['battery', 'nova'], items)).toBe(true)
    expect(scannedUnitsMatchSetTemplate(['nova'], items)).toBe(false)
    expect(scannedUnitsMatchSetTemplate(['nova', 'nova'], items)).toBe(false)
  })

  it('respects quantity greater than one', () => {
    const items = [{ camera_model_id: 'sensor', quantity: 2 }]
    expect(scannedUnitsMatchSetTemplate(['sensor', 'sensor'], items)).toBe(true)
    expect(scannedUnitsMatchSetTemplate(['sensor'], items)).toBe(false)
  })
})
