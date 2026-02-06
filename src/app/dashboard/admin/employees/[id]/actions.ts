'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function assignDealerToSpecialist(specialistId: string, dealerId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Check if user is Aurora Manager
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Managers can assign dealers to specialists' }
  }

  // Check if assignment already exists
  const { data: existing } = await supabase
    .from('specialist_dealers')
    .select('id')
    .eq('specialist_id', specialistId)
    .eq('dealer_id', dealerId)
    .single()

  if (existing) {
    return { success: false, error: 'This dealer is already assigned to this specialist' }
  }

  // Create assignment
  const { error } = await supabase
    .from('specialist_dealers')
    .insert({
      specialist_id: specialistId,
      dealer_id: dealerId
    })

  if (error) {
    console.error('Error assigning dealer:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/admin/employees/${specialistId}`)
  revalidatePath('/dashboard/admin/employees')
  
  return { success: true }
}

export async function removeDealerFromSpecialist(specialistId: string, dealerId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Check if user is Aurora Manager
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Managers can remove dealer assignments' }
  }

  // Remove assignment
  const { error } = await supabase
    .from('specialist_dealers')
    .delete()
    .eq('specialist_id', specialistId)
    .eq('dealer_id', dealerId)

  if (error) {
    console.error('Error removing dealer assignment:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/admin/employees/${specialistId}`)
  revalidatePath('/dashboard/admin/employees')
  
  return { success: true }
}

