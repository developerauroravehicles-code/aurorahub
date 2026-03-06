'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const VALID_STATUSES = ['pending', 'in_progress', 'completed']

export async function createOnboardingTask(formData: {
  profile_id: string
  title: string
  description?: string
  due_date?: string
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
    return { error: 'Only HR can create onboarding tasks' }
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('dealer_id')
    .eq('id', formData.profile_id)
    .single()
  if (targetProfile?.dealer_id != null) {
    return { error: 'Onboarding tasks are only for platform employees' }
  }

  const { data: maxOrder } = await supabase
    .from('onboarding_tasks')
    .select('sort_order')
    .eq('profile_id', formData.profile_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const sortOrder = (maxOrder?.sort_order ?? 0) + 1

  const { error } = await supabase.from('onboarding_tasks').insert({
    profile_id: formData.profile_id,
    title: formData.title,
    description: formData.description || null,
    due_date: formData.due_date || null,
    sort_order: sortOrder,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hr/onboarding')
  return { success: true }
}

export async function updateOnboardingTaskStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'hr') {
    return { error: 'Only HR can update onboarding tasks' }
  }

  if (!VALID_STATUSES.includes(status)) {
    return { error: 'Invalid status' }
  }

  const updateData: Record<string, unknown> = { status }
  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString()
    updateData.completed_by = user.id
  }

  const { error } = await supabase.from('onboarding_tasks').update(updateData).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hr/onboarding')
  return { success: true }
}

export async function deleteOnboardingTask(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'hr') {
    return { error: 'Only HR can delete onboarding tasks' }
  }

  const { error } = await supabase.from('onboarding_tasks').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hr/onboarding')
  return { success: true }
}
