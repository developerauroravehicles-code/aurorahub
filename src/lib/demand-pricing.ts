import type { SupabaseClient } from '@supabase/supabase-js'
import { lookupCameraModelId } from '@/lib/camera-model-resolve'
import { resolveInventoryPrice } from '@/lib/inventory-v2/pricing'

export type DemandServiceType = 'installation' | 'transfer' | 'removal'

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

  if (serviceType === 'installation' && !dealerId) {
    return { error: 'Dealer is required to calculate installation price.' }
  }

  let cameraModelId = input.cameraModelId
  if (serviceType === 'installation') {
    cameraModelId = await resolveCameraModelIdForDemand(
      supabase,
      input.cameraModelId,
      input.cameraModelName
    )
    if (!cameraModelId) {
      return {
        error: `Camera model "${input.cameraModelName ?? 'unknown'}" could not be matched to the catalog.`,
      }
    }
  }

  const resolved = await resolveInventoryPrice(supabase, {
    dealerId,
    cameraModelId: serviceType === 'installation' ? cameraModelId : null,
    serviceType,
  })

  if ('error' in resolved) {
    if (serviceType === 'installation' && dealerId && cameraModelId) {
      const [{ data: dealer }, { data: camera }] = await Promise.all([
        supabase.from('dealers').select('name').eq('id', dealerId).maybeSingle(),
        supabase.from('camera_models').select('name').eq('id', cameraModelId).maybeSingle(),
      ])
      const dealerName = dealer?.name ?? 'dealer'
      const cameraName = camera?.name ?? input.cameraModelName ?? 'camera model'
      return {
        error: `No price configured for ${dealerName} / ${cameraName}. Set pricing in Inventory → Pricing.`,
      }
    }
    return { error: resolved.error }
  }

  const price = resolved.amount
  if (!Number.isFinite(price) || price < 0) {
    return { error: 'Configured price is invalid.' }
  }

  return { amount: price }
}

/** @deprecated Use resolveInventoryPrice / fetchNationalServiceFees instead */
export async function getNationalTransferRemovalFees(
  supabase: SupabaseClient
): Promise<{ transfer: number; removal: number }> {
  const { fetchNationalServiceFees } = await import('@/lib/inventory-v2/pricing')
  const fees = await fetchNationalServiceFees(supabase)
  return {
    transfer: fees.transfer ?? 150,
    removal: fees.removal ?? 100,
  }
}
