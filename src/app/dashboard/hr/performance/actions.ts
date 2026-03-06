'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function ensureAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', supabase: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'hr' && profile?.role !== 'aurora_manager') {
    return { error: 'Unauthorized', supabase: null }
  }
  return { supabase }
}

// Performance metrics
export async function createPerformanceMetric(formData: {
  personnel_id: string
  metric_type?: string
  value?: number
  period_start?: string
  period_end?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('performance_metrics').insert({
    personnel_id: formData.personnel_id,
    metric_type: formData.metric_type?.trim() || null,
    value: formData.value != null ? formData.value : null,
    period_start: formData.period_start || null,
    period_end: formData.period_end || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/performance')
  revalidatePath(`/dashboard/hr/personnel/${formData.personnel_id}`)
  return { success: true }
}

export async function updatePerformanceMetric(
  id: string,
  formData: { metric_type?: string; value?: number; period_start?: string; period_end?: string }
) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.metric_type != null) update.metric_type = formData.metric_type?.trim() || null
  if (formData.value != null) update.value = formData.value
  if (formData.period_start != null) update.period_start = formData.period_start || null
  if (formData.period_end != null) update.period_end = formData.period_end || null
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('performance_metrics').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/performance')
  return { success: true }
}

export async function deletePerformanceMetric(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('performance_metrics').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/performance')
  return { success: true }
}

// Performance feedback
export async function createPerformanceFeedback(formData: {
  personnel_id: string
  feedback_type?: string
  source?: string
  rating?: number
  comment?: string
  demand_id?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('performance_feedback').insert({
    personnel_id: formData.personnel_id,
    feedback_type: formData.feedback_type?.trim() || null,
    source: formData.source?.trim() || null,
    rating: formData.rating != null ? formData.rating : null,
    comment: formData.comment?.trim() || null,
    demand_id: formData.demand_id || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/performance')
  revalidatePath(`/dashboard/hr/personnel/${formData.personnel_id}`)
  return { success: true }
}

export async function updatePerformanceFeedback(
  id: string,
  formData: { feedback_type?: string; source?: string; rating?: number; comment?: string }
) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.feedback_type != null) update.feedback_type = formData.feedback_type?.trim() || null
  if (formData.source != null) update.source = formData.source?.trim() || null
  if (formData.rating != null) update.rating = formData.rating
  if (formData.comment != null) update.comment = formData.comment?.trim() || null
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('performance_feedback').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/performance')
  return { success: true }
}

export async function deletePerformanceFeedback(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('performance_feedback').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/performance')
  return { success: true }
}

// Performance reviews
export async function createPerformanceReview(formData: {
  personnel_id: string
  review_date: string
  reviewer_id?: string
  rating?: number
  notes?: string
  status?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('performance_reviews').insert({
    personnel_id: formData.personnel_id,
    review_date: formData.review_date,
    reviewer_id: formData.reviewer_id || null,
    rating: formData.rating != null ? formData.rating : null,
    notes: formData.notes?.trim() || null,
    status: formData.status?.trim() || 'draft',
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/performance')
  revalidatePath(`/dashboard/hr/personnel/${formData.personnel_id}`)
  return { success: true }
}

export async function updatePerformanceReview(
  id: string,
  formData: { review_date?: string; reviewer_id?: string; rating?: number; notes?: string; status?: string }
) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.review_date != null) update.review_date = formData.review_date
  if (formData.reviewer_id != null) update.reviewer_id = formData.reviewer_id || null
  if (formData.rating != null) update.rating = formData.rating
  if (formData.notes != null) update.notes = formData.notes?.trim() || null
  if (formData.status != null) update.status = formData.status?.trim() || 'draft'
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('performance_reviews').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/performance')
  return { success: true }
}

export async function deletePerformanceReview(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('performance_reviews').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/performance')
  return { success: true }
}
