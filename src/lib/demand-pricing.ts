import type { SupabaseClient } from '@supabase/supabase-js'
import { lookupCameraModelId } from '@/lib/camera-model-resolve'

export type DemandServiceType = 'installation' | 'transfer' | 'removal'

export const TRANSFER_FEE_CAD = 150
export const REMOVAL_FEE_CAD = 100

export const SERVICE_TYPE_LABELS: Record<DemandServiceType, string> = {
  installation: 'Installation',
  transfer: 'Transfer',
  removal: 'Removal',
}

export function isDemandServiceType(value: string): value is DemandServiceType {
  return value === 'installation' || value === 'transfer' || value === 'removal'
}

type PricingInput = {
  dealerId: string | null
  cameraModelId: string | null
  cameraModelName: string | null
  serviceType: DemandServiceType
}

export async function resolveCameraModelIdForDemand(
  supabase: SupabaseClient,
  cameraModelId: string | null,
  cameraModelName: string | null
): Promise<string | null> {
  if (cameraModelId) return cameraModelId
  if (!cameraModelName?.trim()) return null
  return lookupCameraModelId(supabase, cameraModelName)
}

export async function calculateDemandInvoiceAmount(
  supabase: SupabaseClient,
  input: PricingInput
): Promise<{ amount: number } | { error: string }> {
  const { serviceType, dealerId } = input

  if (serviceType === 'transfer') {
    return { amount: TRANSFER_FEE_CAD }
  }
  if (serviceType === 'removal') {
    return { amount: REMOVAL_FEE_CAD }
  }

  if (!dealerId) {
    return { error: 'Dealer is required to calculate installation price.' }
  }

  const modelId = await resolveCameraModelIdForDemand(
    supabase,
    input.cameraModelId,
    input.cameraModelName
  )
  if (!modelId) {
    return {
      error: `Camera model "${input.cameraModelName ?? 'unknown'}" could not be matched to the catalog.`,
    }
  }

  const { data: pricing, error: pricingError } = await supabase
    .from('dealer_camera_pricing')
    .select('price_cad')
    .eq('dealer_id', dealerId)
    .eq('camera_model_id', modelId)
    .maybeSingle()

  if (pricingError) {
    return { error: pricingError.message }
  }
  if (!pricing) {
    const [{ data: dealer }, { data: camera }] = await Promise.all([
      supabase.from('dealers').select('name').eq('id', dealerId).maybeSingle(),
      supabase.from('camera_models').select('name').eq('id', modelId).maybeSingle(),
    ])
    const dealerName = dealer?.name ?? 'dealer'
    const cameraName = camera?.name ?? input.cameraModelName ?? 'camera model'
    return {
      error: `No price configured for ${dealerName} / ${cameraName}. Set pricing in Inventory.`,
    }
  }

  const price = Number(pricing.price_cad)
  if (!Number.isFinite(price) || price < 0) {
    return { error: 'Configured installation price is invalid.' }
  }

  return { amount: price }
}
