'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
  
  // Check if demand belongs to specialist's dealer
  if (demand.dealer_id !== profile.dealer_id) {
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
    .update({ status: 'completed' })
    .eq('id', demandId)
  
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/specialist/work')
  revalidatePath('/dashboard')
  return { success: true }
}

