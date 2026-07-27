import type { DemandExtractResult } from '@/lib/demand-extract-types'
import { normalizeMake, normalizeModel } from '@/lib/normalize-vehicle-fields'

export type DemandExtractApplySetters = {
  setFirstName: (value: string) => void
  setLastName: (value: string) => void
  setPhone: (value: string) => void
  setVehicleYear: (value: string) => void
  setStockNumber: (value: string) => void
  setVinLast6: (value: string) => void
  setSelectedMake: (value: string) => void
  setSelectedModel: (value: string) => void
  setSelectedTrim: (value: string) => void
  setCustomModel: (value: string) => void
}

export type DemandExtractCurrentValues = {
  firstName?: string
  lastName?: string
  phone?: string
  vehicleYear?: string
  stockNumber?: string
  vinLast6?: string
  selectedMake?: string
  selectedModel?: string
  customModel?: string
}

export function hasExistingDemandFieldValues(values: DemandExtractCurrentValues): boolean {
  return Boolean(
    values.firstName?.trim() ||
      values.lastName?.trim() ||
      values.phone?.trim() ||
      values.vehicleYear?.trim() ||
      values.stockNumber?.trim() ||
      values.vinLast6?.trim() ||
      values.selectedMake?.trim() ||
      values.selectedModel?.trim() ||
      values.customModel?.trim()
  )
}

export function applyDemandExtract(
  result: DemandExtractResult,
  setters: DemandExtractApplySetters
): void {
  if (result.firstName.value) {
    setters.setFirstName(result.firstName.value.toUpperCase())
  }
  if (result.lastName.value) {
    setters.setLastName(result.lastName.value.toUpperCase())
  }
  if (result.phone.value) {
    setters.setPhone(result.phone.value)
  }
  if (result.vehicleYear.value) {
    setters.setVehicleYear(result.vehicleYear.value)
  }
  if (result.stockNumber.value) {
    setters.setStockNumber(result.stockNumber.value.toUpperCase())
  }
  if (result.vinLast6.value) {
    setters.setVinLast6(result.vinLast6.value.toUpperCase())
  }

  const makeRaw = result.vehicleMake.value
  // Only set the make when it maps to a known option; the Make field is a
  // select, so an unmatched raw string would leave it looking empty.
  const make = makeRaw ? normalizeMake(makeRaw) : null
  if (make) {
    setters.setSelectedMake(make)
    setters.setSelectedTrim('')

    const modelRaw = result.vehicleModel.value
    if (modelRaw) {
      const { model, useCustom } = normalizeModel(make, modelRaw)
      if (model && !useCustom) {
        // Dropdown options use canonical casing ("Kicks"), not OCR casing ("KICKS").
        setters.setSelectedModel(model)
        setters.setCustomModel('')
      } else if (model) {
        setters.setSelectedModel('__custom__')
        setters.setCustomModel(model)
      }
    }
  }
}
