import { describe, expect, it, vi } from 'vitest'
import { applyDemandExtract } from '@/lib/apply-demand-extract'
import { createEmptyExtractResult } from '@/lib/demand-extract-types'

describe('applyDemandExtract', () => {
  it('selects canonical model casing in the dropdown', () => {
    const result = createEmptyExtractResult()
    result.vehicleMake.value = 'Nissan'
    result.vehicleModel.value = 'Kicks'
    result.vehicleYear.value = '2026'

    const setSelectedMake = vi.fn()
    const setSelectedModel = vi.fn()
    const setSelectedTrim = vi.fn()
    const setCustomModel = vi.fn()
    const setVehicleYear = vi.fn()

    applyDemandExtract(result, {
      setFirstName: vi.fn(),
      setLastName: vi.fn(),
      setPhone: vi.fn(),
      setVehicleYear,
      setStockNumber: vi.fn(),
      setVinLast6: vi.fn(),
      setSelectedMake,
      setSelectedModel,
      setSelectedTrim,
      setCustomModel,
    })

    expect(setSelectedMake).toHaveBeenCalledWith('Nissan')
    expect(setSelectedModel).toHaveBeenCalledWith('Kicks')
    expect(setCustomModel).toHaveBeenCalledWith('')
    expect(setVehicleYear).toHaveBeenCalledWith('2026')
  })

  it('maps uppercase OCR model text to a known dropdown option', () => {
    const result = createEmptyExtractResult()
    result.vehicleMake.value = 'Nissan'
    result.vehicleModel.value = 'KICKS'

    const setSelectedModel = vi.fn()
    const setCustomModel = vi.fn()

    applyDemandExtract(result, {
      setFirstName: vi.fn(),
      setLastName: vi.fn(),
      setPhone: vi.fn(),
      setVehicleYear: vi.fn(),
      setStockNumber: vi.fn(),
      setVinLast6: vi.fn(),
      setSelectedMake: vi.fn(),
      setSelectedModel,
      setSelectedTrim: vi.fn(),
      setCustomModel,
    })

    expect(setSelectedModel).toHaveBeenCalledWith('Kicks')
    expect(setCustomModel).toHaveBeenCalledWith('')
  })
})
