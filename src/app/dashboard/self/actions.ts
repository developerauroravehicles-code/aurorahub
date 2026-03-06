'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Platform users can request their own leave from Self Portal */
export async function requestLeave(formData: {
  leave_type: string
  start_date: string
  end_date: string
  notes?: string
}): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('dealer_id')
    .eq('id', user.id)
    .single()

  if (profile?.dealer_id != null) {
    return { error: 'Leave requests are only for platform users' }
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

  const { error } = await supabase.from('leave_requests').insert({
    profile_id: user.id,
    leave_type: formData.leave_type,
    start_date: formData.start_date,
    end_date: formData.end_date,
    notes: formData.notes?.trim() || null,
    status: 'pending',
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/self')
  return { success: true }
}

/** Platform users can create IT tickets from Self Portal */
export async function createITRequest(formData: {
  title: string
  description?: string
  category: string
  priority?: string
}): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('dealer_id')
    .eq('id', user.id)
    .single()

  if (profile?.dealer_id != null) {
    return { error: 'IT requests are only for platform users' }
  }

  const validCategories = ['bug_report', 'feature_request', 'system_issue', 'access_request', 'integration_request', 'security_incident', 'other']
  if (!validCategories.includes(formData.category)) {
    return { error: 'Invalid category' }
  }

  const { error } = await supabase.from('it_tickets').insert({
    title: formData.title.trim(),
    description: formData.description?.trim() || null,
    category: formData.category,
    priority: formData.priority || 'medium',
    requested_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/self')
  return { success: true }
}
