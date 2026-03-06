import { createClient } from '@/lib/supabase/server'
import { PayrollContent } from './payroll-content'

export default async function PayrollPage() {
  const supabase = await createClient()

  const [
    { data: structures },
    { data: perCompletedTiers },
    { data: payments },
    { data: personnel },
  ] = await Promise.all([
    supabase.from('compensation_structures').select('id, personnel_id, payment_type, amount, effective_from, effective_to, notes, personnel(full_name)').order('effective_from', { ascending: false }),
    supabase.from('compensation_per_completed').select('id, personnel_id, base_completed, base_amount, per_completed_amount, currency, effective_from, effective_to, notes, personnel(full_name)').order('effective_from', { ascending: false }),
    supabase.from('payment_records').select('id, personnel_id, amount, currency, payment_type, period_start, period_end, completed_count, deduction_metadata, status, paid_at, notes, personnel(full_name)').order('created_at', { ascending: false }),
    supabase.from('personnel').select('id, full_name').order('full_name'),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Payroll & Compensation</h1>
        <p className="text-gray-400">Salary, hourly, per-completed tiered pay, Canadian payroll (bodro) with CPP, EI, taxes.</p>
      </div>
      <PayrollContent
        structures={structures ?? []}
        perCompletedTiers={perCompletedTiers ?? []}
        payments={payments ?? []}
        personnel={personnel ?? []}
      />
    </div>
  )
}
