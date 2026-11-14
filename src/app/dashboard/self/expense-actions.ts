'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SpecialistExpenseClaim } from '@/lib/specialist-expense-claims'
import {
  expenseAccessError,
  expenseRevalidatePaths,
  getMyExpenseClaimsCore,
  previewExtraDutyCore,
  submitExpenseClaimCore,
} from '@/lib/self/expenses'

async function verifySpecialistSelf() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const, supabase: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, dealer_id')
    .eq('id', user.id)
    .single()

  const accessError = expenseAccessError(profile)
  if (accessError || !profile) return { error: accessError ?? 'Unauthorized', supabase: null, profile: null }

  return { error: null, supabase, profile }
}

export async function getMyExpenseClaims(): Promise<{
  error?: string
  claims?: SpecialistExpenseClaim[]
}> {
  const auth = await verifySpecialistSelf()
  if (auth.error || !auth.supabase || !auth.profile) return { error: auth.error ?? 'Unauthorized' }
  return getMyExpenseClaimsCore(auth.supabase, auth.profile.id)
}

export async function previewExtraDutyClaim(
  hours: string,
  minutes: string
): Promise<{ error?: string; amount?: number; hourlyRate?: number; durationMinutes?: number }> {
  const auth = await verifySpecialistSelf()
  if (auth.error || !auth.supabase || !auth.profile) return { error: auth.error ?? 'Unauthorized' }
  return previewExtraDutyCore(auth.supabase, auth.profile.id, hours, minutes)
}

export async function submitSpecialistExpenseClaim(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const auth = await verifySpecialistSelf()
  if (auth.error || !auth.supabase || !auth.profile) return { error: auth.error ?? 'Unauthorized' }

  const receipt = formData.get('receipt')
  const result = await submitExpenseClaimCore(auth.supabase, auth.profile, {
    description: String(formData.get('description') ?? ''),
    expenseDate: String(formData.get('expense_date') ?? ''),
    category: String(formData.get('category') ?? 'travel'),
    amount: String(formData.get('amount') ?? ''),
    dutyHours: String(formData.get('duty_hours') ?? '0'),
    dutyMinutes: String(formData.get('duty_minutes') ?? '0'),
    receipt:
      receipt instanceof File && receipt.size > 0
        ? {
            buffer: Buffer.from(await receipt.arrayBuffer()),
            mimeType: receipt.type,
            fileName: receipt.name,
            size: receipt.size,
          }
        : null,
  })
  if ('error' in result) return { error: result.error }

  for (const path of expenseRevalidatePaths(auth.profile.id)) revalidatePath(path)
  return { success: true }
}
