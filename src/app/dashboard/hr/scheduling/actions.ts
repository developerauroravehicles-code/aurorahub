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

// Availability
export async function createAvailability(formData: {
  personnel_id: string
  day_of_week: number
  start_time?: string
  end_time?: string
  is_available?: boolean
  valid_from?: string
  valid_to?: string
  notes?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('personnel_availability').insert({
    personnel_id: formData.personnel_id,
    day_of_week: formData.day_of_week,
    start_time: formData.start_time || null,
    end_time: formData.end_time || null,
    is_available: formData.is_available ?? true,
    valid_from: formData.valid_from || null,
    valid_to: formData.valid_to || null,
    notes: formData.notes?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/scheduling')
  revalidatePath(`/dashboard/hr/personnel/${formData.personnel_id}`)
  return { success: true }
}

export async function updateAvailability(
  id: string,
  formData: {
    day_of_week?: number
    start_time?: string
    end_time?: string
    is_available?: boolean
    valid_from?: string
    valid_to?: string
    notes?: string
  }
) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.day_of_week != null) update.day_of_week = formData.day_of_week
  if (formData.start_time != null) update.start_time = formData.start_time || null
  if (formData.end_time != null) update.end_time = formData.end_time || null
  if (formData.is_available != null) update.is_available = formData.is_available
  if (formData.valid_from != null) update.valid_from = formData.valid_from || null
  if (formData.valid_to != null) update.valid_to = formData.valid_to || null
  if (formData.notes != null) update.notes = formData.notes?.trim() || null
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('personnel_availability').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/scheduling')
  return { success: true }
}

export async function deleteAvailability(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('personnel_availability').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/scheduling')
  return { success: true }
}

// Leave Blocks
export async function createLeaveBlock(formData: {
  personnel_id: string
  start_date: string
  end_date: string
  reason?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  if (formData.start_date > formData.end_date) {
    return { error: 'End date must be on or after start date' }
  }
  const { error } = await supabase.from('personnel_leave_blocks').insert({
    personnel_id: formData.personnel_id,
    start_date: formData.start_date,
    end_date: formData.end_date,
    reason: formData.reason?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/scheduling')
  revalidatePath(`/dashboard/hr/personnel/${formData.personnel_id}`)
  return { success: true }
}

export async function updateLeaveBlock(
  id: string,
  formData: { start_date?: string; end_date?: string; reason?: string }
) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
    return { error: 'End date must be on or after start date' }
  }
  const update: Record<string, unknown> = {}
  if (formData.start_date != null) update.start_date = formData.start_date
  if (formData.end_date != null) update.end_date = formData.end_date
  if (formData.reason != null) update.reason = formData.reason?.trim() || null
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('personnel_leave_blocks').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/scheduling')
  return { success: true }
}

export async function deleteLeaveBlock(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('personnel_leave_blocks').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/scheduling')
  return { success: true }
}
