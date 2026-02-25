'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  const { error } = await supabase
    .from('demands')
    .update({ assigned_specialist_id: specialistId })
    .eq('id', demandId)

  if (error) return { success: false, error: error.message }

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

  const { error } = await supabase
    .from('demands')
    .update({ assigned_finance_id: financeId })
    .eq('id', demandId)

  if (error) return { success: false, error: error.message }

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
