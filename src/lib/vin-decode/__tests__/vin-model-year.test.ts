import { describe, expect, it } from 'vitest'
import { modelYearHintFromVin } from '@/lib/vin-decode/vin-model-year'

describe('modelYearHintFromVin', () => {
  it('reads 2017 from sample Subaru VIN', () => {
    expect(modelYearHintFromVin('4S4BSACCXH3331708')).toBe(2017)
  })

  it('returns null for short input', () => {
    expect(modelYearHintFromVin('ABC')).toBeNull()
  })
})