import type { SupabaseClient } from '@supabase/supabase-js'
import { EXPENSE_CATEGORY_LABELS, type SpecialistExpenseCategory } from '@/lib/specialist-expense-claims'

export async function notifyAuroraManagersExpenseClaimPending(
  adminSupabase: SupabaseClient,
  input: {
    claimId: string
    submitterProfileId: string
    submitterName: string
    category: SpecialistExpenseCategory
    amount: number
    expenseDate: string
  }
): Promise<void> {
  const { data: managers } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('role', 'aurora_manager')

  if (!managers?.length) return

  const categoryLabel = EXPENSE_CATEGORY_LABELS[input.category] ?? input.category
  const rows = managers.map((m) => ({
    user_id: m.id,
    type: 'expense_claim_pending' as const,
    payload: {
      claim_id: input.claimId,
      profile_id: input.submitterProfileId,
      submitter_name: input.submitterName,
      category: input.category,
      category_label: categoryLabel,
      amount: input.amount,
      expense_date: input.expenseDate,
    },
  }))

  await adminSupabase.from('comm_notifications').insert(rows)
}
