'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logDemandChange } from '@/lib/demand-logger'
import { isSpecialistDoubleBooked } from '@/lib/scheduling-pool'
import {
  isBarcodeModeEnabled,
  validateSpecialistBarcode,
} from '@/lib/inventory-barcodes'
import {
  completeDemandCore,
  COMPLETE_DEMAND_REVALIDATE_PATHS,
  type CompleteDemandOptions,
} from '@/lib/demands/complete-demand'

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
      { excludeDemandId: demandId }
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

export type { DelayFeeTier } from '@/lib/demands/complete-demand'

export async function getWorkBarcodeModeEnabled() {
  return isBarcodeModeEnabled()
}

export async function previewWorkBarcode(code: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }

  const trimmed = code.trim()
  if (!trimmed) return { error: 'Enter a barcode' as const }

  const result = await validateSpecialistBarcode(supabase, trimmed)
  if (!result.valid) return { error: result.error ?? 'Invalid barcode' }
  return { ok: true as const, code: trimmed.toUpperCase(), modelName: result.cameraModelName ?? 'Unit' }
}

export async function completeDemand(demandId: string, options: CompleteDemandOptions) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const result = await completeDemandCore(supabase, user.id, demandId, options)
  if ('error' in result) return { error: result.error }

  for (const path of COMPLETE_DEMAND_REVALIDATE_PATHS) revalidatePath(path)
  return { success: true }
}
