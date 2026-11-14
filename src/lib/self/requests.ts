import type { SupabaseClient } from '@supabase/supabase-js'

export const LEAVE_TYPES = ['vacation', 'sick', 'personal', 'bereavement', 'parental', 'other'] as const
export const IT_CATEGORIES = [
  'bug_report',
  'feature_request',
  'system_issue',
  'access_request',
  'integration_request',
  'security_incident',
  'other',
] as const
export const IT_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export type LeaveRequestInput = {
  leave_type: string
  start_date: string
  end_date: string
  notes?: string
}

export type ITRequestInput = {
  title: string
  description?: string
  category: string
  priority?: string
}

type Result = { error: string } | { success: true }

async function isDealerUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: profile } = await supabase.from('profiles').select('dealer_id').eq('id', userId).single()
  return profile?.dealer_id != null
}

/** Platform users request their own leave (Self Portal + field app). */
export async function requestLeaveCore(
  supabase: SupabaseClient,
  userId: string,
  input: LeaveRequestInput
): Promise<Result> {
  if (await isDealerUser(supabase, userId)) {
    return { error: 'Leave requests are only for platform users' }
  }
  if (!(LEAVE_TYPES as readonly string[]).includes(input.leave_type)) {
    return { error: 'Invalid leave type' }
  }

  const start = new Date(input.start_date)
  const end = new Date(input.end_date)
  if (end < start) return { error: 'End date must be on or after start date' }

  const { error } = await supabase.from('leave_requests').insert({
    profile_id: userId,
    leave_type: input.leave_type,
    start_date: input.start_date,
    end_date: input.end_date,
    notes: input.notes?.trim() || null,
    status: 'pending',
    created_by: userId,
  })
  if (error) return { error: error.message }
  return { success: true }
}

/** Platform users open IT tickets (Self Portal + field app). */
export async function createITRequestCore(
  supabase: SupabaseClient,
  userId: string,
  input: ITRequestInput
): Promise<Result> {
  if (await isDealerUser(supabase, userId)) {
    return { error: 'IT requests are only for platform users' }
  }
  if (!(IT_CATEGORIES as readonly string[]).includes(input.category)) {
    return { error: 'Invalid category' }
  }

  const { error } = await supabase.from('it_tickets').insert({
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category,
    priority: input.priority || 'medium',
    requested_by: userId,
  })
  if (error) return { error: error.message }
  return { success: true }
}
