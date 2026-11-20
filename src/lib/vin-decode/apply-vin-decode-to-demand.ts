import type { SupabaseClient } from '@supabase/supabase-js'
import { decodeVinFromNhtsa, isNhtsaDecodeUncertain, normalizeVinInput, validateVinFormat } from './nhtsa-vpic'
import { mapVinDecodeToDemandFields, type DemandVehicleFieldsFromVin } from './map-to-demand-vehicle'
import { modelYearHintFromVin } from './vin-model-year'

export function demandVehicleFromVinFields(
  fullVin: string,
  fields: DemandVehicleFieldsFromVin
): { vehicle_make: string; vehicle_model: string; vehicle_year: number } {
  const make = (fields.selectedMake || fields.rawMake || 'Unknown').trim().toUpperCase()
  let model = ''
  if (fields.selectedModel === '__custom__') {
    model = fields.customModel
  } else if (fields.selectedModel) {
    model = fields.selectedTrim
      ? `${fields.selectedModel} (${fields.selectedTrim})`
      : fields.selectedModel
  } else {
    model = fields.rawModel
  }
  model = (model || 'Unknown').trim()
  const yearParsed = parseInt(fields.vehicleYear, 10)
  const vehicle_year =
    Number.isFinite(yearParsed) && yearParsed >= 1900
      ? yearParsed
      : modelYearHintFromVin(fullVin) ?? new Date().getFullYear()
  return { vehicle_make: make, vehicle_model: model, vehicle_year }
}

export function shouldMarkVinDecodeWarningAfterDecode(
  decode: Awaited<ReturnType<typeof decodeVinFromNhtsa>>,
  fields: DemandVehicleFieldsFromVin
): boolean {
  if (isNhtsaDecodeUncertain(decode)) return true
  if (fields.makeUnmapped) return true
  if (!fields.vehicleYear) return true
  if (!fields.selectedMake && !fields.rawMake) return true
  if (!fields.selectedModel && !fields.customModel && !fields.rawModel) return true
  return false
}

/**
 * Decode full VIN and persist vehicle fields on an existing demand (server-only).
 */
export async function applyVinDecodeToDemand(
  supabase: SupabaseClient,
  demandId: string,
  fullVinRaw: string
): Promise<
  | {
      ok: true
      vehicle_make: string
      vehicle_model: string
      vehicle_year: number
      vin_last6: string
      vin_decode_warning: boolean
    }
  | { ok: false; vin_decode_warning: true; vin_last6: string }
> {
  const validated = validateVinFormat(fullVinRaw)
  if ('error' in validated) {
    const vinLast6 = normalizeVinInput(fullVinRaw).slice(-6).toUpperCase()
    if (vinLast6.length >= 6) {
      await supabase
        .from('demands')
        .update({ vin_decode_warning: true, vin_last6: vinLast6 })
        .eq('id', demandId)
    }
    return { ok: false, vin_decode_warning: true, vin_last6: vinLast6 }
  }

  const fullVin = validated.vin
  const vinLast6 = fullVin.slice(-6)

  try {
    const decode = await decodeVinFromNhtsa(fullVin)
    const fields = mapVinDecodeToDemandFields(fullVin, decode)
    const vehicle = demandVehicleFromVinFields(fullVin, fields)
    const vin_decode_warning = shouldMarkVinDecodeWarningAfterDecode(decode, fields)

    const { error } = await supabase
      .from('demands')
      .update({
        ...vehicle,
        vin_last6: vinLast6,
        vin_decode_warning,
        updated_at: new Date().toISOString(),
      })
      .eq('id', demandId)

    if (error) {
      console.error('applyVinDecodeToDemand update failed:', error)
      return { ok: false, vin_decode_warning: true, vin_last6: vinLast6 }
    }

    return { ok: true, ...vehicle, vin_last6: vinLast6, vin_decode_warning }
  } catch (e) {
    console.error('applyVinDecodeToDemand decode failed:', e)
    await supabase
      .from('demands')
      .update({ vin_last6: vinLast6, vin_decode_warning: true, updated_at: new Date().toISOString() })
      .eq('id', demandId)
    return { ok: false, vin_decode_warning: true, vin_last6: vinLast6 }
  }
}