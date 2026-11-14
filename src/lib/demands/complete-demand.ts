import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { logDemandChange } from '@/lib/demand-logger'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'
import { issuePortalTokenForPhone } from '@/lib/issue-portal-token-for-phone'
import { addDemandToDailyBatch } from '@/lib/daily-dealer-invoices'
import {
  calculateDemandInvoiceAmount,
  DemandServiceType,
  isBarcodeRequiredForServiceType,
  isDemandServiceType,
  resolveCameraModelIdForDemand,
} from '@/lib/demand-pricing'
import { isSpecialistDoubleBooked } from '@/lib/scheduling-pool'
import {
  isBarcodeModeEnabled,
  consumeBarcodesForDemand,
  validateSpecialistBarcode,
} from '@/lib/inventory-barcodes'

export type DelayFeeTier = 'none' | '30min' | '60min'

export const DELAY_FEE_TIERS: DelayFeeTier[] = ['none', '30min', '60min']

export type CompleteDemandOptions = {
  serviceType: DemandServiceType
  vinLast6?: string
  skipVinCheck?: boolean
  delayFeeTier?: DelayFeeTier
  barcodeCode?: string
  /** Multiple unit scans for one job (set installs, extra cameras). */
  barcodeCodes?: string[]
}

export type CompleteDemandResult = { success: true } | { error: string }

/**
 * Core "specialist completes a job" flow, shared by the web server action
 * (cookie session) and the mobile field API (Bearer token session).
 *
 * `supabase` must be a client acting as `userId` so RLS applies exactly as
 * it does for the web. Cache revalidation is left to the caller.
 */
export async function completeDemandCore(
  supabase: SupabaseClient,
  userId: string,
  demandId: string,
  options: CompleteDemandOptions
): Promise<CompleteDemandResult> {
  if (!options?.serviceType || !isDemandServiceType(options.serviceType)) {
    return { error: 'Service type is required.' }
  }

  const delayFeeTier: DelayFeeTier =
    options.delayFeeTier && DELAY_FEE_TIERS.includes(options.delayFeeTier)
      ? options.delayFeeTier
      : 'none'

  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_specialist_id, status, vin_last6, dealer_id, camera_model_id, camera_model, customer_phone, appointment_date')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Work not found' }

  const expectedVin = (demand.vin_last6 || '').trim().toUpperCase()
  const skipVin = !!options.skipVinCheck

  if (expectedVin) {
    const normalized = (options.vinLast6 || '').trim().toUpperCase().slice(-6)
    if (normalized !== expectedVin) {
      return { error: 'VIN last 6 digits do not match. Please enter the correct VIN last 6 digits.' }
    }
  } else if (!skipVin) {
    return { error: 'Cannot complete: VIN not on file. Contact administrator.' }
  }

  if (demand.assigned_specialist_id && demand.assigned_specialist_id !== userId) {
    return { error: 'You can only complete work assigned to you' }
  }

  if (!demand.assigned_specialist_id) {
    if (demand.appointment_date) {
      const doubleBooked = await isSpecialistDoubleBooked(
        supabase,
        userId,
        demand.appointment_date,
        { excludeDemandId: demandId }
      )
      if (doubleBooked) {
        return { error: 'You already have another appointment at this time.' }
      }
    }
    await supabase
      .from('demands')
      .update({ assigned_specialist_id: userId })
      .eq('id', demandId)
  }

  const admin = createAdminClient()
  const barcodeMode = await isBarcodeModeEnabled(supabase)
  let cameraModelIdFromBarcode: string | null = null
  const barcodeCodesToConsume =
    options.barcodeCodes?.map((c) => c.trim()).filter(Boolean) ??
    (options.barcodeCode?.trim() ? [options.barcodeCode.trim()] : [])

  if (barcodeMode) {
    const barcodeRequired = isBarcodeRequiredForServiceType(options.serviceType)
    if (barcodeRequired && barcodeCodesToConsume.length === 0) {
      return { error: 'Scan at least one product barcode to complete this job.' }
    }
    if (barcodeCodesToConsume.length > 0) {
      if (!demand.dealer_id) {
        return { error: 'Demand has no dealer assigned.' }
      }

      for (const code of barcodeCodesToConsume) {
        const { valid, error: barcodeError } = await validateSpecialistBarcode(supabase, code)
        if (!valid) return { error: barcodeError ?? `Invalid barcode: ${code}` }
      }

      const { data: lookupRows } = await supabase.rpc('lookup_specialist_barcode_for_completion', {
        p_code: barcodeCodesToConsume[0]!.toUpperCase(),
      })
      const lookup = Array.isArray(lookupRows) ? lookupRows[0] : lookupRows
      cameraModelIdFromBarcode = lookup?.camera_model_id ?? null
    }
  }

  const pricingCameraModelId = cameraModelIdFromBarcode ?? demand.camera_model_id
  const pricingResult = await calculateDemandInvoiceAmount(admin, {
    dealerId: demand.dealer_id,
    cameraModelId: pricingCameraModelId,
    cameraModelName: demand.camera_model,
    serviceType: options.serviceType,
  })
  if ('error' in pricingResult) {
    return { error: pricingResult.error }
  }

  if (barcodeMode && barcodeCodesToConsume.length > 0 && demand.dealer_id) {
    const consumeResult = await consumeBarcodesForDemand(supabase, admin, {
      codes: barcodeCodesToConsume,
      demandId,
      specialistId: userId,
      dealerId: demand.dealer_id,
      actorId: userId,
      serviceType: options.serviceType,
    })
    if (consumeResult.error) return { error: consumeResult.error }
    cameraModelIdFromBarcode = consumeResult.cameraModelIds[0] ?? cameraModelIdFromBarcode
  }

  const resolvedCameraModelId =
    cameraModelIdFromBarcode ??
    (await resolveCameraModelIdForDemand(supabase, demand.camera_model_id, demand.camera_model))

  const { error } = await supabase
    .from('demands')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      service_type: options.serviceType,
      delay_fee_tier: delayFeeTier,
      invoice_total_amount: pricingResult.amount,
      ...(resolvedCameraModelId && !demand.camera_model_id
        ? { camera_model_id: resolvedCameraModelId }
        : cameraModelIdFromBarcode
          ? { camera_model_id: cameraModelIdFromBarcode }
          : {}),
    })
    .eq('id', demandId)

  if (error) return { error: error.message }

  addDemandToDailyBatch(admin, demandId).catch(() => {})

  logDemandChange({
    demandId,
    actorId: userId,
    previousStatus: 'approved',
    newStatus: 'completed',
    notes: `Demand completed (${options.serviceType}${delayFeeTier !== 'none' ? `, delay ${delayFeeTier}` : ''}${barcodeCodesToConsume.length ? `, barcodes: ${barcodeCodesToConsume.join(', ')}` : ''})`,
  }).catch(() => {})

  dispatchWebhooks(supabase, 'appointment_completed', {
    demand_id: demandId,
    previous_status: 'approved',
    new_status: 'completed',
  }).catch(() => {})

  dispatchWebhooks(supabase, 'demand_status_change', {
    demand_id: demandId,
    previous_status: 'approved',
    new_status: 'completed',
  }).catch(() => {})

  if (demand.customer_phone?.trim()) {
    issuePortalTokenForPhone(demand.customer_phone).then((portal) => {
      if (!portal) return
      dispatchWebhooks(supabase, 'demand_completed', {
        demand_id: demandId,
        customer_phone: demand.customer_phone,
        portal_url: portal.url,
        portal_expires_at: portal.expires_at,
        hint: 'External SMS/email service can send portal_url to the customer.',
      }).catch(() => {})
    }).catch(() => {})
  } else {
    dispatchWebhooks(supabase, 'demand_completed', {
      demand_id: demandId,
      portal_url: null,
      hint: 'No customer phone on file; call POST /api/customer-portal/issue-token when phone is available.',
    }).catch(() => {})
  }

  return { success: true }
}

/** Paths whose cached data changes when a demand is completed. */
export const COMPLETE_DEMAND_REVALIDATE_PATHS = [
  '/dashboard/specialist/work',
  '/dashboard/admin/invoices',
  '/dashboard/admin/daily-invoices',
  '/dashboard/admin/inventory',
  '/dashboard',
] as const
