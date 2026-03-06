'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const VALID_ROLES = ['specialist', 'aurora_manager', 'hr', 'it']
const VALID_STATUSES = ['open', 'interviewing', 'offer', 'filled', 'cancelled']

export async function createRecruitmentPosition(formData: {
  title: string
  role: string
  description?: string
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
    return { error: 'Only HR can create recruitment positions' }
  }

  if (!VALID_ROLES.includes(formData.role)) {
    return { error: 'Invalid role' }
  }

  const { error } = await supabase.from('recruitment_positions').insert({
    title: formData.title,
    role: formData.role,
    dealer_id: null,
    description: formData.description || null,
    status: 'open',
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hr/recruitment')
  return { success: true }
}

export async function updateRecruitmentPositionStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'hr') {
    return { error: 'Only HR can update recruitment positions' }
  }

  if (!VALID_STATUSES.includes(status)) {
    return { error: 'Invalid status' }
  }

  const updateData: Record<string, unknown> = { status }
  if (status === 'filled') {
    updateData.filled_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('recruitment_positions')
    .update(updateData)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hr/recruitment')
  return { success: true }
}

export async function fillRecruitmentPosition(id: string, profileId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'hr') {
    return { error: 'Only HR can fill positions' }
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('dealer_id')
    .eq('id', profileId)
    .single()
  if (targetProfile?.dealer_id != null) {
    return { error: 'Can only assign platform employees to positions' }
  }

  const { error } = await supabase
    .from('recruitment_positions')
    .update({ status: 'filled', filled_by: profileId, filled_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hr/recruitment')
  return { success: true }
}
