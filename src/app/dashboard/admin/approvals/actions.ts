'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { approveExpenseClaimWithPayroll } from '@/lib/expense-claim-approve'
import type { SpecialistExpenseClaim } from '@/lib/specialist-expense-claims'

async function ensureAuroraManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, userId: null, supabase: null }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can use Approvals.' as const, userId: null, supabase: null }
  }

  return { error: null, userId: user.id, supabase }
}

export async function getPendingExpenseClaimsCount(): Promise<number> {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase) return 0

  const { count } = await auth.supabase
    .from('specialist_expense_claims')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  return count ?? 0
}

export type PendingExpenseClaimRow = SpecialistExpenseClaim & {
  submitter_name: string | null
}

export async function listPendingExpenseClaims(): Promise<{
  error?: string
  claims?: PendingExpenseClaimRow[]
}> {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const { data, error } = await auth.supabase
    .from('specialist_expense_claims')
    .select('*, profiles!specialist_expense_claims_profile_id_fkey(full_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return { error: error.message }

  const claims = (data ?? []).map((row) => {
    const profilesRaw = row.profiles as { full_name: string | null } | { full_name: string | null }[] | null
    const name = Array.isArray(profilesRaw) ? profilesRaw[0]?.full_name : profilesRaw?.full_name
    const { profiles: _p, ...rest } = row as Record<string, unknown>
    return { ...(rest as SpecialistExpenseClaim), submitter_name: name ?? null }
  })

  return { claims }
}

export async function approvePendingExpenseClaim(
  claimId: string
): Promise<{ error?: string; success?: boolean; payableOn?: string }> {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const result = await approveExpenseClaimWithPayroll(auth.supabase, {
    claimId,
    reviewerId: auth.userId,
  })

  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/admin/approvals')
  revalidatePath('/dashboard/admin/employees')
  revalidatePath('/dashboard/self')
  return { success: true, payableOn: result.payableOn }
}

export async function rejectPendingExpenseClaim(
  claimId: string,
  reason: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const trimmedReason = reason.trim().slice(0, 500)
  if (!trimmedReason) return { error: 'Rejection reason is required.' }

  const { data: claim } = await auth.supabase
    .from('specialist_expense_claims')
    .select('id, status')
    .eq('id', claimId)
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

  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/approvals')
  revalidatePath('/dashboard/admin/employees')
  revalidatePath('/dashboard/self')
  return { success: true }
}
