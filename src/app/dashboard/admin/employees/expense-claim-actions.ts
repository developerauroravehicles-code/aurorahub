'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SpecialistExpenseClaim } from '@/lib/specialist-expense-claims'

async function ensureAmOrHr() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, userId: null, supabase: null }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['aurora_manager', 'hr'].includes(profile.role)) {
    return { error: 'Only Aurora Manager or HR can review expenses' as const, userId: null, supabase: null }
  }

  return { error: null, userId: user.id, supabase }
}

export async function getSpecialistExpenseClaims(
  profileId: string
): Promise<{ error?: string; claims?: SpecialistExpenseClaim[] }> {
  const auth = await ensureAmOrHr()
  if (auth.error || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const { data, error } = await auth.supabase
    .from('specialist_expense_claims')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { error: error.message }
  return { claims: (data ?? []) as SpecialistExpenseClaim[] }
}

export async function approveSpecialistExpenseClaim(
  claimId: string,
  profileId: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await ensureAmOrHr()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const { data: claim } = await auth.supabase
    .from('specialist_expense_claims')
    .select('id, status')
    .eq('id', claimId)
    .eq('profile_id', profileId)
    .single()

  if (!claim) return { error: 'Expense claim not found.' }
  if (claim.status !== 'pending') return { error: 'Only pending claims can be approved.' }

  const { error } = await auth.supabase
    .from('specialist_expense_claims')
    .update({
      status: 'approved',
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId)
    .eq('profile_id', profileId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/admin/employees/${profileId}`)
  revalidatePath('/dashboard/admin/employees')
  revalidatePath('/dashboard/self')
  return { success: true }
}

export async function rejectSpecialistExpenseClaim(
  claimId: string,
  profileId: string,
  reason: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await ensureAmOrHr()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const trimmedReason = reason.trim().slice(0, 500)
  if (!trimmedReason) return { error: 'Rejection reason is required.' }

  const { data: claim } = await auth.supabase
    .from('specialist_expense_claims')
    .select('id, status')
    .eq('id', claimId)
    .eq('profile_id', profileId)
    .single()

  if (!claim) return { error: 'Expense claim not found.' }
  if (claim.status !== 'pending') return { error: 'Only pending claims can be rejected.' }

  const { error } = await auth.supabase
    .from('specialist_expense_claims')
    .update({
      status: 'rejected',
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: trimmedReason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId)
    .eq('profile_id', profileId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/admin/employees/${profileId}`)
  revalidatePath('/dashboard/admin/employees')
  revalidatePath('/dashboard/self')
  return { success: true }
}
