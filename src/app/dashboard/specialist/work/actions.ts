'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logDemandChange } from '@/lib/demand-logger'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'
import { issuePortalTokenForPhone } from '@/lib/issue-portal-token-for-phone'
import { addDemandToDailyBatch } from '@/lib/daily-dealer-invoices'
import {
  calculateDemandInvoiceAmount,
  DemandServiceType,
  isDemandServiceType,
  resolveCameraModelIdForDemand,
} from '@/lib/demand-pricing'
import { isSpecialistDoubleBooked } from '@/lib/scheduling-pool'
import { isBarcodeModeEnabled, consumeBarcodeForDemand, validateSpecialistBarcode } from '@/lib/inventory-barcodes'

export async function assignWorkToMe(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is specialist
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, dealer_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'specialist') {
    return { error: 'Only specialists can assign work' }
  }

  // Check if demand is already assigned
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_specialist_id, status, dealer_id, appointment_date')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Work not found' }

  // Allowed dealers: from specialist_dealers, or fallback to profile.dealer_id
  const { data: specialistDealers } = await supabase
    .from('specialist_dealers')
    .select('dealer_id')
    .eq('specialist_id', user.id)
  const allowedDealerIds: string[] = (specialistDealers?.length ?? 0) > 0
    ? specialistDealers!.map((sd: { dealer_id: string }) => sd.dealer_id)
    : (profile.dealer_id ? [profile.dealer_id] : [])

  if (allowedDealerIds.length === 0) {
    return { error: 'Your account is not assigned to any dealer' }
  }
  if (!demand.dealer_id || !allowedDealerIds.includes(demand.dealer_id)) {
    return { error: 'This work does not belong to your dealer' }
  }
  
  if (demand.assigned_specialist_id && demand.assigned_specialist_id !== user.id) {
    return { error: 'This work is already assigned to another specialist' }
  }

  if (demand.status !== 'approved') {
    return { error: 'Only approved work can be assigned' }
  }

  if (demand.appointment_date) {
    const doubleBooked = await isSpecialistDoubleBooked(
      supabase,
      user.id,
      demand.appointment_date,
      demandId
    )
    if (doubleBooked) {
      return { error: 'You already have another appointment at this time.' }
    }
  }

  // Assign work to current user
  const { error } = await supabase
    .from('demands')
    .update({ assigned_specialist_id: user.id })
    .eq('id', demandId)

  if (error) return { error: error.message }

  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: 'approved',
    newStatus: 'approved',
    notes: 'Assigned to specialist',
  }).catch(() => {})

  revalidatePath('/dashboard/specialist/work')
  revalidatePath('/dashboard')
  return { success: true }
}

export type DelayFeeTier = 'none' | '30min' | '60min'

const DELAY_FEE_TIERS: DelayFeeTier[] = ['none', '30min', '60min']

type CompleteDemandOptions = {
  serviceType: DemandServiceType
  vinLast6?: string
  skipVinCheck?: boolean
  delayFeeTier?: DelayFeeTier
  barcodeCode?: string
}

export async function getWorkBarcodeModeEnabled() {
  return isBarcodeModeEnabled()
}

export async function completeDemand(demandId: string, options: CompleteDemandOptions) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

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

  if (demand.assigned_specialist_id && demand.assigned_specialist_id !== user.id) {
    return { error: 'You can only complete work assigned to you' }
  }

  if (!demand.assigned_specialist_id) {
    if (demand.appointment_date) {
      const doubleBooked = await isSpecialistDoubleBooked(
        supabase,
        user.id,
        demand.appointment_date,
        demandId
      )
      if (doubleBooked) {
        return { error: 'You already have another appointment at this time.' }
      }
    }
    await supabase
      .from('demands')
      .update({ assigned_specialist_id: user.id })
      .eq('id', demandId)
  }

  const admin = createAdminClient()
  const barcodeMode = await isBarcodeModeEnabled(supabase)
  let cameraModelIdFromBarcode: string | null = null
  let validatedBarcodeCode: string | null = null

  if (barcodeMode) {
    if (!options.barcodeCode?.trim()) {
      return { error: 'Barcode scan is required to complete this job.' }
    }
    if (!demand.dealer_id) {
      return { error: 'Demand has no dealer assigned.' }
    }

    const { valid, error: barcodeError } = await validateSpecialistBarcode(
      supabase,
      options.barcodeCode!.trim()
    )
    if (!valid) return { error: barcodeError ?? 'Invalid barcode' }
    validatedBarcodeCode = options.barcodeCode.trim()

    const { data: lookupRows } = await supabase.rpc('lookup_specialist_barcode_for_completion', {
      p_code: validatedBarcodeCode.toUpperCase(),
    })
    const lookup = Array.isArray(lookupRows) ? lookupRows[0] : lookupRows
    cameraModelIdFromBarcode = lookup?.camera_model_id ?? null
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

  if (barcodeMode && validatedBarcodeCode && demand.dealer_id) {
    const consumeResult = await consumeBarcodeForDemand(supabase, admin, {
      code: validatedBarcodeCode,
      demandId,
      specialistId: user.id,
      dealerId: demand.dealer_id,
      actorId: user.id,
      serviceType: options.serviceType,
    })
    if (consumeResult.error) return { error: consumeResult.error }
    cameraModelIdFromBarcode = consumeResult.cameraModelId ?? cameraModelIdFromBarcode
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
    actorId: user.id,
    previousStatus: 'approved',
    newStatus: 'completed',
    notes: `Demand completed (${options.serviceType}${delayFeeTier !== 'none' ? `, delay ${delayFeeTier}` : ''})`,
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
  
  revalidatePath('/dashboard/specialist/work')
  revalidatePath('/dashboard/admin/invoices')
  revalidatePath('/dashboard/admin/daily-invoices')
  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: true }
}
