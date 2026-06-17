'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logDemandChange } from '@/lib/demand-logger'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'
import { addDemandToDailyBatch } from '@/lib/daily-dealer-invoices'
import {
  calculateDemandInvoiceAmount,
  DemandServiceType,
  isDemandServiceType,
  resolveCameraModelIdForDemand,
} from '@/lib/demand-pricing'

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
    .select('assigned_specialist_id, status, dealer_id')
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

type CompleteDemandOptions = {
  serviceType: DemandServiceType
  vinLast6?: string
  skipVinCheck?: boolean
}

export async function completeDemand(demandId: string, options: CompleteDemandOptions) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  if (!options?.serviceType || !isDemandServiceType(options.serviceType)) {
    return { error: 'Service type is required.' }
  }

  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_specialist_id, status, vin_last6, dealer_id, camera_model_id, camera_model')
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
    await supabase
      .from('demands')
      .update({ assigned_specialist_id: user.id })
      .eq('id', demandId)
  }

  const pricingResult = await calculateDemandInvoiceAmount(supabase, {
    dealerId: demand.dealer_id,
    cameraModelId: demand.camera_model_id,
    cameraModelName: demand.camera_model,
    serviceType: options.serviceType,
  })
  if ('error' in pricingResult) {
    return { error: pricingResult.error }
  }

  const resolvedCameraModelId = await resolveCameraModelIdForDemand(
    supabase,
    demand.camera_model_id,
    demand.camera_model
  )

  const { error } = await supabase
    .from('demands')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      service_type: options.serviceType,
      invoice_total_amount: pricingResult.amount,
      ...(resolvedCameraModelId && !demand.camera_model_id
        ? { camera_model_id: resolvedCameraModelId }
        : {}),
    })
    .eq('id', demandId)
  
  if (error) return { error: error.message }

  const admin = createAdminClient()
  addDemandToDailyBatch(admin, demandId).catch(() => {})

  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: 'approved',
    newStatus: 'completed',
    notes: `Demand completed (${options.serviceType})`,
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
  
  revalidatePath('/dashboard/specialist/work')
  revalidatePath('/dashboard/admin/invoices')
  revalidatePath('/dashboard/admin/daily-invoices')
  revalidatePath('/dashboard')
  return { success: true }
}
