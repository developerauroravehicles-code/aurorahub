import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getActiveCameraModelById,
  lookupCameraModelId,
} from '@/lib/camera-model-resolve'
import { inferBookingCameraFromScannedUnits } from '@/lib/camera-model-infer-from-units'
import {
  calculateDemandInvoiceAmount,
  DemandServiceType,
} from '@/lib/demand-pricing'
import { lookupUnitBarcodeAtSpecialist } from '@/lib/inventory-barcodes'

export type ExternalDemandMissingPrice = {
  dealerId: string
  dealerName: string
  cameraModelId: string
  cameraModelName: string
  serviceType: DemandServiceType
}

export async function resolveExternalDemandCameraAndPrice(
  supabase: SupabaseClient,
  input: {
    dealerId: string
    cameraModel: string
    cameraModelIdFromForm: string
    completeOnCreate: boolean
    serviceType: DemandServiceType | null
    barcodeCodes: string[]
    assignedSpecialistId?: string
  }
): Promise<
  | {
      amount: number
      cameraModelId: string | null
      cameraModelName: string
    }
  | { error: string; missingPrice?: ExternalDemandMissingPrice }
> {
  const {
    dealerId,
    cameraModel,
    cameraModelIdFromForm,
    completeOnCreate,
    serviceType,
    barcodeCodes,
    assignedSpecialistId,
  } = input

  if (!completeOnCreate || !serviceType) {
    return { amount: 0, cameraModelId: null, cameraModelName: cameraModel }
  }

  let resolvedCameraModelId =
    (await getActiveCameraModelById(supabase, cameraModelIdFromForm))?.id ??
    (await lookupCameraModelId(supabase, cameraModel))

  let resolvedCameraModelName = cameraModel

  if (serviceType === 'installation' && barcodeCodes.length > 0 && assignedSpecialistId) {
    const admin = createAdminClient()
    const unitModelIds: string[] = []
    for (const code of barcodeCodes) {
      const unit = await lookupUnitBarcodeAtSpecialist(admin, code, assignedSpecialistId)
      if (!('error' in unit)) unitModelIds.push(unit.cameraModelId)
    }
    if (unitModelIds.length > 0) {
      const inferred = await inferBookingCameraFromScannedUnits(supabase, unitModelIds)
      if (inferred) {
        resolvedCameraModelId = inferred.cameraModelId
        resolvedCameraModelName = inferred.cameraModelName
      }
    }
  }

  const pricingResult = await calculateDemandInvoiceAmount(supabase, {
    dealerId,
    cameraModelId: resolvedCameraModelId,
    cameraModelName: resolvedCameraModelName,
    serviceType,
  })

  if ('error' in pricingResult) {
    const missingPrice =
      serviceType === 'installation' &&
      resolvedCameraModelId &&
      pricingResult.error.includes('No price configured')
        ? await loadMissingPriceMeta(
            supabase,
            dealerId,
            resolvedCameraModelId,
            resolvedCameraModelName,
            serviceType
          )
        : undefined
    return { error: pricingResult.error, missingPrice }
  }

  return {
    amount: pricingResult.amount,
    cameraModelId: resolvedCameraModelId,
    cameraModelName: resolvedCameraModelName,
  }
}

async function loadMissingPriceMeta(
  supabase: SupabaseClient,
  dealerId: string,
  cameraModelId: string,
  cameraModelName: string,
  serviceType: DemandServiceType
): Promise<ExternalDemandMissingPrice | undefined> {
  const { data: dealer } = await supabase.from('dealers').select('name').eq('id', dealerId).maybeSingle()
  return {
    dealerId,
    dealerName: dealer?.name ?? 'dealer',
    cameraModelId,
    cameraModelName,
    serviceType,
  }
}
