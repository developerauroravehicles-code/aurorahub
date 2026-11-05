import type { SupabaseClient } from '@supabase/supabase-js'
import {
  EXPENSE_CATEGORY_LABELS,
  type SpecialistExpenseCategory,
} from '@/lib/specialist-expense-claims'
import { payPeriodForInstallmentDate, resolveNextPayableOn } from '@/lib/expense-payroll-queue'
import { formatDurationMinutes } from '@/lib/extra-duty-compensation'

export async function approveExpenseClaimWithPayroll(
  supabase: SupabaseClient,
  input: {
    claimId: string
    reviewerId: string
    profileId?: string
  }
): Promise<{ error?: string; success?: boolean; payableOn?: string }> {
  let query = supabase
    .from('specialist_expense_claims')
    .select('id, profile_id, status, category, amount, description, duration_minutes')
    .eq('id', input.claimId)

  if (input.profileId) {
    query = query.eq('profile_id', input.profileId)
  }

  const { data: claim } = await query.single()

  if (!claim) return { error: 'Expense claim not found.' }
  if (claim.status !== 'pending') return { error: 'Only pending claims can be approved.' }

  const profileId = claim.profile_id as string

  const { data: personnel } = await supabase
    .from('personnel')
    .select('salary_pay_schedule')
    .eq('profile_id', profileId)
    .maybeSingle()

  const today = new Date().toISOString().slice(0, 10)
  const payableOn = resolveNextPayableOn(personnel?.salary_pay_schedule, today)
  const now = new Date().toISOString()

  const { error: updErr } = await supabase
    .from('specialist_expense_claims')
    .update({
      status: 'approved',
      reviewed_by: input.reviewerId,
      reviewed_at: now,
      rejection_reason: '',
      payable_on: payableOn,
      updated_at: now,
    })
    .eq('id', input.claimId)

  if (updErr) return { error: updErr.message }

  const category = claim.category as SpecialistExpenseCategory
  const categoryLabel = EXPENSE_CATEGORY_LABELS[category] ?? category
  const duration =
    claim.duration_minutes != null ? formatDurationMinutes(Number(claim.duration_minutes)) : null
  const label =
    category === 'extra_duty' && duration
      ? `Extra Duty (${duration})`
      : `${categoryLabel}: ${(claim.description as string).slice(0, 80)}`

  const { start, end } = payPeriodForInstallmentDate(payableOn)

  const { error: payrollErr } = await supabase.from('specialist_manual_payroll_items').insert({
    profile_id: profileId,
    label: label.slice(0, 120),
    amount: Number(claim.amount),
    period_start: start,
    period_end: end,
    notes: `Approved expense claim ${input.claimId}; pays on ${payableOn}`,
    created_by: input.reviewerId,
  })

  if (payrollErr) {
    return { error: payrollErr.message }
  }

  await supabase
    .from('specialist_expense_claims')
    .update({ payroll_applied_at: now })
    .eq('id', input.claimId)

  return { success: true, payableOn }
}
