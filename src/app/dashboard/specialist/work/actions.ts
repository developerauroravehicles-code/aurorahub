'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logDemandChange } from '@/lib/demand-logger'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'

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

export async function completeDemand(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if demand is assigned to current user
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_specialist_id, status')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Work not found' }

  // Only assigned specialists can complete
  if (demand.assigned_specialist_id && demand.assigned_specialist_id !== user.id) {
    return { error: 'You can only complete work assigned to you' }
  }

  // If not assigned, assign it first
  if (!demand.assigned_specialist_id) {
    await supabase
      .from('demands')
      .update({ assigned_specialist_id: user.id })
      .eq('id', demandId)
  }

  const { error } = await supabase
    .from('demands')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', demandId)
  
  if (error) return { error: error.message }

  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: 'approved',
    newStatus: 'completed',
    notes: 'Demand completed',
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
  revalidatePath('/dashboard')
  return { success: true }
}

