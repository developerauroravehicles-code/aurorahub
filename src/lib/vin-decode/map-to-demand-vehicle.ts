import { normalizeMake, normalizeModel } from '@/lib/normalize-vehicle-fields'
import { getTrimsForModel } from '@/lib/vehicle-models'
import type { NhtsaVinDecode } from './nhtsa-vpic'
import { normalizeVinInput } from './nhtsa-vpic'

export type DemandVehicleFieldsFromVin = {
  vinLast6: string
  vehicleYear: string
  selectedMake: string
  selectedModel: string
  selectedTrim: string
  customModel: string
  /** When make could not be mapped to the Canada dropdown */
  makeUnmapped: boolean
  /** Raw make/model from NHTSA for display hints */
  rawMake: string
  rawModel: string
}

function normalizeTrimToken(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function matchTrimInCatalog(make: string, model: string, trimRaw: string): string {
  const t = trimRaw.trim()
  if (!t) return ''
  const options = getTrimsForModel(make, model)
  if (!options.length) return ''

  const token = normalizeTrimToken(t)
  for (const opt of options) {
    if (normalizeTrimToken(opt) === token) return opt
  }
  for (const opt of options) {
    const optToken = normalizeTrimToken(opt)
    if (token.includes(optToken) || optToken.includes(token)) return opt
  }
  return ''
}

export function mapVinDecodeToDemandFields(
  vin: string,
  decode: NhtsaVinDecode
): DemandVehicleFieldsFromVin {
  const normalizedVin = normalizeVinInput(vin)
  const vinLast6 = normalizedVin.slice(-6)

  const yearRaw = decode.modelYear.trim()
  const vehicleYear = /^\d{4}$/.test(yearRaw) ? yearRaw : ''

  const rawMake = decode.make.trim()
  const rawModel = (decode.model.trim() || decode.series.trim()).trim()

  const make = normalizeMake(rawMake)
  let selectedMake = make ?? ''
  let selectedModel = ''
  let selectedTrim = ''
  let customModel = ''
  const makeUnmapped = !make

  if (make && rawModel) {
    const { model, useCustom } = normalizeModel(make, rawModel)
    if (model && !useCustom) {
      selectedModel = model
      const trimCandidate = decode.trim.trim() || decode.series.trim()
      selectedTrim = matchTrimInCatalog(make, model, trimCandidate)
    } else if (model) {
      selectedModel = '__custom__'
      customModel = model
    }
  }

  return {
    vinLast6,
    vehicleYear,
    selectedMake,
    selectedModel,
    selectedTrim,
    customModel,
    makeUnmapped,
    rawMake,
    rawModel,
  }
}
