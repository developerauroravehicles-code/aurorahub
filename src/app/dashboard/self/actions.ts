'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  createITRequestCore,
  requestLeaveCore,
  type ITRequestInput,
  type LeaveRequestInput,
} from '@/lib/self/requests'

/** Platform users can request their own leave from Self Portal */
export async function requestLeave(
  formData: LeaveRequestInput
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const result = await requestLeaveCore(supabase, user.id, formData)
  if ('error' in result) return { error: result.error }
  revalidatePath('/dashboard/self')
  return { success: true }
}

/** Platform users can create IT tickets from Self Portal */
export async function createITRequest(
  formData: ITRequestInput
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const result = await createITRequestCore(supabase, user.id, formData)
  if ('error' in result) return { error: result.error }
  revalidatePath('/dashboard/self')
  return { success: true }
}
