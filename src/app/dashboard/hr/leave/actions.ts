'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createLeaveRequest(formData: {
  profile_id: string
  leave_type: string
  start_date: string
  end_date: string
  notes?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'hr') {
    return { error: 'Only HR can create leave requests' }
  }

  const validTypes = ['vacation', 'sick', 'personal', 'bereavement', 'parental', 'other']
  if (!validTypes.includes(formData.leave_type)) {
    return { error: 'Invalid leave type' }
  }

  const start = new Date(formData.start_date)
  const end = new Date(formData.end_date)
  if (end < start) {
    return { error: 'End date must be on or after start date' }
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('dealer_id')
    .eq('id', formData.profile_id)
    .single()
  if (targetProfile?.dealer_id != null) {
    return { error: 'Leave requests are only for platform employees' }
  }

  const { error } = await supabase.from('leave_requests').insert({
    profile_id: formData.profile_id,
    leave_type: formData.leave_type,
    start_date: formData.start_date,
    end_date: formData.end_date,
    notes: formData.notes || null,
    status: 'pending',
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hr/leave')
  redirect('/dashboard/hr/leave')
}

export async function approveLeaveRequest(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['hr', 'aurora_manager'].includes(profile?.role ?? '')) {
    return { error: 'Only HR or Aurora Manager can approve leave requests' }
  }

  const { error } = await supabase
    .from('leave_requests')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hr/leave')
  return { success: true }
}

export async function rejectLeaveRequest(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['hr', 'aurora_manager'].includes(profile?.role ?? '')) {
    return { error: 'Only HR or Aurora Manager can reject leave requests' }
  }

  const { error } = await supabase
    .from('leave_requests')
    .update({ status: 'rejected', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hr/leave')
  return { success: true }
}
