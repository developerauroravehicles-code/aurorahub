'use server'

import { createClient } from '@/lib/supabase/server'
import { decodeVinFromNhtsa, isNhtsaDecodeUncertain, type NhtsaVinDecode } from './nhtsa-vpic'
import { mapVinDecodeToDemandFields, type DemandVehicleFieldsFromVin } from './map-to-demand-vehicle'

const ALLOWED_ROLES = new Set([
  'aurora_manager',
  'general_manager',
  'sales',
  'finance',
  'dealer_sales',
  'inventory_manager',
])

export type DecodeVinForDemandResult =
  | {
      ok: true
      fields: DemandVehicleFieldsFromVin
      hint?: string
      /** Persist `vin_decode_warning` on the demand when true */
      markVinDecodeWarning: boolean
    }
  | { error: string }

function shouldMarkVinDecodeWarning(decode: NhtsaVinDecode, fields: DemandVehicleFieldsFromVin): boolean {
  if (isNhtsaDecodeUncertain(decode)) return true
  if (fields.makeUnmapped) return true
  if (!fields.vehicleYear) return true
  if (!fields.selectedMake && !fields.rawMake) return true
  if (!fields.selectedModel && !fields.customModel && !fields.rawModel) return true
  return false
}

export async function decodeVinForDemand(vin: string): Promise<DecodeVinForDemandResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile?.role || !ALLOWED_ROLES.has(profile.role)) {
    return { error: 'You do not have permission to decode VINs' }
  }

  try {
    const decode = await decodeVinFromNhtsa(vin)
    const fields = mapVinDecodeToDemandFields(vin, decode)

    const hints: string[] = []
    if (isNhtsaDecodeUncertain(decode)) {
      const caveat = decode.errorText || 'NHTSA reported a VIN validation issue — verify vehicle details.'
      hints.push(caveat)
    }
    if (fields.makeUnmapped) {
      hints.push(`Make "${fields.rawMake}" is not in the dropdown — select make manually.`)
    } else if (!fields.selectedModel && fields.rawModel) {
      hints.push(`Model "${fields.rawModel}" could not be matched — use Other or pick from the list.`)
    }

    const hint = hints.length > 0 ? hints.join(' ') : undefined
    const markVinDecodeWarning = shouldMarkVinDecodeWarning(decode, fields)

    return { ok: true, fields, hint, markVinDecodeWarning }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'VIN decode failed'
    return { error: message }
  }
}