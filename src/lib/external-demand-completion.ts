import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { logDemandChange } from '@/lib/demand-logger'
import { addDemandToDailyBatch } from '@/lib/daily-dealer-invoices'
import {
  consumeBarcodesForDemand,
  isBarcodeModeEnabled,
  rollbackDemandBarcodeConsumption,
  validateUnitBarcodesAtSpecialist,
} from '@/lib/inventory-barcodes'
import {
  DemandServiceType,
  isBarcodeRequiredForServiceType,
} from '@/lib/demand-pricing'
import type { DemandStatus } from '@/lib/demand-logger'
import { resolveExternalDemandCameraAndPrice } from '@/app/dashboard/admin/demands/create-external-demand-pricing'

export type ExternalDemandCompletionContext = {
  supabase: SupabaseClient
  admin: SupabaseClient
  user: User
  demand: {
    id: string
    dealer_id: string
    appointment_date: string
    camera_model: string
    camera_model_id?: string | null
    assigned_specialist_id?: string | null
    status: string
  }
  serviceType: DemandServiceType
  barcodeCodes: string[]
  assignedSpecialistId?: string
  cameraModelIdFromForm?: string
  previousStatus: string
}

export async function applyExternalDemandCompletion(
  ctx: ExternalDemandCompletionContext
): Promise<{ error?: string }> {
  const specialistId =
    ctx.assignedSpecialistId?.trim() ||
    ctx.demand.assigned_specialist_id?.trim() ||
    undefined

  const barcodeMode = await isBarcodeModeEnabled(ctx.supabase)
  const barcodeRequired = isBarcodeRequiredForServiceType(ctx.serviceType)

  if (barcodeMode) {
    if (barcodeRequired) {
      if (!specialistId) {
        return {
          error:
            'Select the specialist who performed the work — barcodes are consumed from their field stock.',
        }
      }
      if (ctx.barcodeCodes.length === 0) {
        return { error: 'Scan at least one product barcode (unit label) before completing.' }
      }
    } else if (ctx.barcodeCodes.length > 0 && !specialistId) {
      return {
        error: 'Select the specialist whose field stock the scanned barcodes belong to.',
      }
    }
  }

  if (barcodeMode && specialistId && ctx.barcodeCodes.length > 0) {
    const barcodeCheck = await validateUnitBarcodesAtSpecialist(
      ctx.admin,
      ctx.barcodeCodes,
      specialistId,
      { allowOrphanedConsumed: true }
    )
    if ('error' in barcodeCheck) {
      return { error: barcodeCheck.error }
    }
  }

  const pricing = await resolveExternalDemandCameraAndPrice(ctx.supabase, {
    dealerId: ctx.demand.dealer_id,
    cameraModel: ctx.demand.camera_model,
    cameraModelIdFromForm: ctx.cameraModelIdFromForm ?? ctx.demand.camera_model_id ?? '',
    completeOnCreate: true,
    serviceType: ctx.serviceType,
    barcodeCodes: ctx.barcodeCodes,
    assignedSpecialistId: specialistId,
  })
  if ('error' in pricing) {
    return { error: pricing.error }
  }

  const updatePayload: Record<string, unknown> = {
    status: 'completed',
    completed_at: ctx.demand.appointment_date,
    service_type: ctx.serviceType,
    invoice_total_amount: pricing.amount,
    camera_model: pricing.cameraModelName,
  }
  if (pricing.cameraModelId) {
    updatePayload.camera_model_id = pricing.cameraModelId
  }
  if (specialistId) {
    updatePayload.assigned_specialist_id = specialistId
  }

  const { error: updateError } = await ctx.supabase
    .from('demands')
    .update(updatePayload)
    .eq('id', ctx.demand.id)

  if (updateError) {
    return { error: updateError.message }
  }

  if (barcodeMode && specialistId && ctx.barcodeCodes.length > 0) {
    const consumeResult = await consumeBarcodesForDemand(ctx.supabase, ctx.admin, {
      codes: ctx.barcodeCodes,
      demandId: ctx.demand.id,
      specialistId,
      dealerId: ctx.demand.dealer_id,
      actorId: ctx.user.id,
      serviceType: ctx.serviceType,
      adminResolveForSpecialist: true,
    })
    if (consumeResult.error) {
      await rollbackDemandBarcodeConsumption(ctx.admin, {
        demandId: ctx.demand.id,
        actorId: ctx.user.id,
        reason: 'External demand completion aborted after barcode consume failure',
      })
      await ctx.supabase
        .from('demands')
        .update({ status: ctx.previousStatus, completed_at: null, service_type: null, invoice_total_amount: null })
        .eq('id', ctx.demand.id)
      return { error: consumeResult.error }
    }
  }

  addDemandToDailyBatch(ctx.admin, ctx.demand.id).catch(() => {})

  logDemandChange({
    demandId: ctx.demand.id,
    actorId: ctx.user.id,
    previousStatus: ctx.previousStatus as DemandStatus,
    newStatus: 'completed',
    notes: 'External demand marked completed by Aurora Manager',
  }).catch(() => {})

  return {}
}
