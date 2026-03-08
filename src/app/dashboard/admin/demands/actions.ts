'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logDemandChange } from '@/lib/demand-logger'

export async function updateAssignedSpecialist(
  demandId: string,
  specialistId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Manager can change specialist assignment' }
  }

  const { data: demand } = await supabase
    .from('demands')
    .select('status')
    .eq('id', demandId)
    .single()

  const { error } = await supabase
    .from('demands')
    .update({ assigned_specialist_id: specialistId })
    .eq('id', demandId)

  if (error) return { success: false, error: error.message }

  const status = (demand?.status ?? 'approved') as 'pending_finance' | 'approved' | 'completed' | 'cancelled'
  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: status,
    newStatus: status,
    notes: specialistId ? 'Specialist changed' : 'Specialist unassigned',
  }).catch(() => {})

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  return { success: true }
}

export async function updateAssignedFinance(
  demandId: string,
  financeId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Manager can change finance assignment' }
  }

  const { data: demand } = await supabase
    .from('demands')
    .select('status')
    .eq('id', demandId)
    .single()

  const { error } = await supabase
    .from('demands')
    .update({ assigned_finance_id: financeId })
    .eq('id', demandId)

  if (error) return { success: false, error: error.message }

  const status = (demand?.status ?? 'pending_finance') as 'pending_finance' | 'approved' | 'completed' | 'cancelled'
  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: status,
    newStatus: status,
    notes: financeId ? 'Finance changed' : 'Finance unassigned',
  }).catch(() => {})

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  return { success: true }
}

export async function updateCustomerInfo(
  demandId: string,
  data: { firstName: string; lastName: string; phone: string; address?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Manager can update customer info' }
  }

  const firstName = (data.firstName || '').trim()
  const lastName = (data.lastName || '').trim()
  const phone = (data.phone || '').trim()
  if (!firstName || !lastName || !phone) {
    return { success: false, error: 'First name, last name and phone are required' }
  }

  const { data: demand } = await supabase
    .from('demands')
    .select('status')
    .eq('id', demandId)
    .single()

  const { error } = await supabase
    .from('demands')
    .update({
      customer_firstname: firstName,
      customer_lastname: lastName,
      customer_phone: phone,
      customer_address: (data.address || '').trim() || null,
    })
    .eq('id', demandId)

  if (error) return { success: false, error: error.message }

  const status = (demand?.status ?? 'pending_finance') as string
  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: status,
    newStatus: status,
    notes: 'Customer information updated',
  }).catch(() => {})

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  return { success: true }
}

export async function updateVinLast6(
  demandId: string,
  vinLast6: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Manager can update VIN' }
  }

  const normalized = (vinLast6 || '').trim().replace(/\s/g, '').slice(-6).toUpperCase()
  if (normalized.length < 6) {
    return { success: false, error: 'VIN last 6 digits is required (exactly 6 characters)' }
  }

  const { data: demand } = await supabase
    .from('demands')
    .select('status')
    .eq('id', demandId)
    .single()

  const { error } = await supabase
    .from('demands')
    .update({ vin_last6: normalized })
    .eq('id', demandId)

  if (error) return { success: false, error: error.message }

  const status = (demand?.status ?? 'pending_finance') as string
  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: status,
    newStatus: status,
    notes: 'VIN last 6 digits updated',
  }).catch(() => {})

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  return { success: true }
}

export async function deleteDemand(demandId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can delete demands' }
  }

  const { error } = await supabase.from('demands').delete().eq('id', demandId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/demands')
  return {}
}
