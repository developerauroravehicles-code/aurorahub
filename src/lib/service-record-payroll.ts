import type { SupabaseClient } from '@supabase/supabase-js'

const SERVICE_FEE_AMOUNT = 20

function periodMonthFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

async function resolvePersonnelId(
  supabase: SupabaseClient,
  profileId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('personnel')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle()
  return data?.id ?? null
}

/** Record $20 service fee once when a service record is completed (idempotent). */
export async function recordServiceCompletionEarning(
  supabase: SupabaseClient,
  serviceRecordId: string,
  specialistProfileId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: record, error: fetchErr } = await supabase
    .from('customer_service_records')
    .select('id, compensation_recorded_at, service_fee_amount, completed_at')
    .eq('id', serviceRecordId)
    .single()

  if (fetchErr || !record) return { ok: false, error: 'Service record not found.' }
  if (record.compensation_recorded_at) return { ok: true }

  const personnelId = await resolvePersonnelId(supabase, specialistProfileId)
  if (!personnelId) {
    return { ok: false, error: 'Specialist has no linked personnel record for payroll.' }
  }

  const completedAt = record.completed_at ? new Date(record.completed_at) : new Date()
  const periodMonth = periodMonthFromDate(completedAt)
  const amount = Number(record.service_fee_amount) || SERVICE_FEE_AMOUNT

  const { error: insertErr } = await supabase.from('service_record_completion_earnings').insert({
    personnel_id: personnelId,
    service_record_id: serviceRecordId,
    amount,
    earning_type: 'service_fee',
    period_month: periodMonth,
  })

  if (insertErr) {
    if (insertErr.code === '23505') {
      await supabase
        .from('customer_service_records')
        .update({ compensation_recorded_at: new Date().toISOString() })
        .eq('id', serviceRecordId)
      return { ok: true }
    }
    return { ok: false, error: insertErr.message }
  }

  const { error: updateErr } = await supabase
    .from('customer_service_records')
    .update({ compensation_recorded_at: new Date().toISOString() })
    .eq('id', serviceRecordId)

  if (updateErr) return { ok: false, error: updateErr.message }
  return { ok: true }
}

/** Record approved expense reimbursement for payroll (idempotent per expense). */
export async function recordExpenseReimbursement(
  supabase: SupabaseClient,
  expenseId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: expense, error: fetchErr } = await supabase
    .from('service_record_expenses')
    .select('id, amount, status, payroll_recorded_at, service_record_id, submitted_by')
    .eq('id', expenseId)
    .single()

  if (fetchErr || !expense) return { ok: false, error: 'Expense not found.' }
  if (expense.status !== 'approved') return { ok: false, error: 'Expense is not approved.' }
  if (expense.payroll_recorded_at) return { ok: true }

  const { data: record } = await supabase
    .from('customer_service_records')
    .select('assigned_specialist_id, completed_at')
    .eq('id', expense.service_record_id)
    .single()

  const specialistId = record?.assigned_specialist_id ?? expense.submitted_by
  if (!specialistId) return { ok: false, error: 'No specialist linked for reimbursement.' }

  const personnelId = await resolvePersonnelId(supabase, specialistId)
  if (!personnelId) return { ok: false, error: 'Specialist has no personnel record.' }

  const baseDate = record?.completed_at ? new Date(record.completed_at) : new Date()
  const periodMonth = periodMonthFromDate(baseDate)

  const { error: insertErr } = await supabase.from('service_record_completion_earnings').insert({
    personnel_id: personnelId,
    service_record_id: expense.service_record_id,
    expense_id: expenseId,
    amount: expense.amount,
    earning_type: 'expense_reimbursement',
    period_month: periodMonth,
  })

  if (insertErr && insertErr.code !== '23505') {
    return { ok: false, error: insertErr.message }
  }

  await supabase
    .from('service_record_expenses')
    .update({ payroll_recorded_at: new Date().toISOString() })
    .eq('id', expenseId)

  return { ok: true }
}

export type ServicePayrollEarning = {
  id: string
  service_record_id: string
  expense_id: string | null
  amount: number
  earning_type: string
  period_month: string
  demand_number: string
  description: string
}

export async function getServicePayrollEarnings(
  supabase: SupabaseClient,
  personnelId: string,
  periodStart: string,
  periodEnd: string
): Promise<ServicePayrollEarning[]> {
  const { data, error } = await supabase.rpc('get_service_completion_earnings_for_payroll', {
    p_personnel_id: personnelId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  })

  if (error) {
    console.error('get_service_completion_earnings_for_payroll', error.message)
    return []
  }

  return (data ?? []) as ServicePayrollEarning[]
}
