'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendSMS } from '@/lib/twilio'
import { format } from 'date-fns'

export async function assignDemandToMe(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is finance
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'finance') {
    return { error: 'Only finance users can assign demands' }
  }

  // Check if demand is already assigned
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, status')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }
  
  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'This demand is already assigned to another finance user' }
  }

  if (demand.status !== 'pending_finance') {
    return { error: 'Only pending demands can be assigned' }
  }

  // Assign demand to current user
  const { error } = await supabase
    .from('demands')
    .update({ assigned_finance_id: user.id })
    .eq('id', demandId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function approveDemand(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is finance and demand is assigned to them
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, status, dealer_id, customer_phone, appointment_date')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }

  if (demand.status !== 'pending_finance') {
    return { error: 'Only pending demands can be approved' }
  }

  // Check if demand is assigned to current user
  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'You can only approve demands assigned to you' }
  }

  // If not assigned, assign it first
  if (!demand.assigned_finance_id) {
    await supabase
      .from('demands')
      .update({ assigned_finance_id: user.id })
      .eq('id', demandId)
  }
  
  // Update status
  const { error: updateError } = await supabase
    .from('demands')
    .update({ status: 'approved' })
    .eq('id', demandId)

  if (updateError) return { error: updateError.message }

  // Fetch dealer info for message
  const { data: dealer } = await supabase
    .from('dealers')
    .select('name, address')
    .eq('id', demand.dealer_id)
    .single()
  
  const dateStr = format(new Date(demand.appointment_date), 'MMMM dd, yyyy \'at\' HH:mm')
  const location = dealer?.address || dealer?.name || 'Authorized Dealer'
  
  const message = `An appointment has been created for ${dateStr} at ${location}. Aurora Vehicles.`
  
  // Send SMS
  await sendSMS(demand.customer_phone, message)

  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function cancelDemand(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if demand is assigned to current user
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, status')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }

  // Only assigned finance users can cancel
  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'You can only cancel demands assigned to you' }
  }

  const { error } = await supabase
    .from('demands')
    .update({ status: 'cancelled' })
    .eq('id', demandId)
  
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

