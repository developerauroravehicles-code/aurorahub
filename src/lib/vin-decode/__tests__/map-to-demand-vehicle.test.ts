import { describe, expect, it } from 'vitest'
import { mapVinDecodeToDemandFields } from '@/lib/vin-decode/map-to-demand-vehicle'

const SAMPLE_VIN = '4S4BSACCXH3331708'

describe('mapVinDecodeToDemandFields', () => {
  it('maps Subaru Outback-style decode to catalog fields', () => {
    const fields = mapVinDecodeToDemandFields(SAMPLE_VIN, {
      make: 'SUBARU',
      model: 'Outback',
      modelYear: '2017',
      trim: 'Touring',
      series: '',
    })

    expect(fields.vinLast6).toBe('331708')
    expect(fields.vehicleYear).toBe('2017')
    expect(fields.selectedMake).toBe('Subaru')
    expect(fields.selectedModel).toBe('Outback')
    expect(fields.makeUnmapped).toBe(false)
  })

  it('uses custom model when not in catalog', () => {
    const fields = mapVinDecodeToDemandFields(SAMPLE_VIN, {
      make: 'Subaru',
      model: 'Wilderness Touring Plus',
      modelYear: '2024',
      trim: '',
      series: '',
    })

    expect(fields.selectedMake).toBe('Subaru')
    expect(fields.selectedModel).toBe('__custom__')
    expect(fields.customModel).toBeTruthy()
  })

  it('flags unmapped make', () => {
    const fields = mapVinDecodeToDemandFields(SAMPLE_VIN, {
      make: 'UnknownBrandZZ',
      model: 'Foo',
      modelYear: '2020',
      trim: '',
      series: '',
    })

    expect(fields.makeUnmapped).toBe(true)
    expect(fields.selectedMake).toBe('')
  })
})
