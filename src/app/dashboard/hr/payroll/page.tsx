import { createClient } from '@/lib/supabase/server'
import { PayrollContent } from './payroll-content'

function normPersonnel(p: unknown): { full_name: string } | null {
  if (!p) return null
  const arr = Array.isArray(p) ? p : [p]
  const first = arr[0] as { full_name?: string } | undefined
  return first ? { full_name: first.full_name ?? '' } : null
}

export default async function PayrollPage() {
  const supabase = await createClient()

  const [
    { data: structuresRaw },
    { data: perCompletedTiersRaw },
    { data: paymentsRaw },
    { data: personnel },
  ] = await Promise.all([
    supabase.from('compensation_structures').select('id, personnel_id, payment_type, amount, effective_from, effective_to, notes, personnel(full_name)').order('effective_from', { ascending: false }),
    supabase.from('compensation_per_completed').select('id, personnel_id, base_completed, base_amount, per_completed_amount, currency, effective_from, effective_to, notes, personnel(full_name)').order('effective_from', { ascending: false }),
    supabase.from('payment_records').select('id, personnel_id, amount, currency, payment_type, period_start, period_end, completed_count, deduction_metadata, status, paid_at, notes, personnel(full_name)').order('created_at', { ascending: false }),
    supabase.from('personnel').select('id, full_name').order('full_name'),
  ])

  const structures = (structuresRaw ?? []).map((s) => ({ ...s, personnel: normPersonnel(s.personnel) }))
  const perCompletedTiers = (perCompletedTiersRaw ?? []).map((t) => ({ ...t, personnel: normPersonnel(t.personnel) }))
  const payments = (paymentsRaw ?? []).map((p) => ({ ...p, personnel: normPersonnel(p.personnel) }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Payroll & Compensation</h1>
        <p className="text-zinc-500 dark:text-gray-400">
          Salary, hourly, per-completed tiered pay, Canadian payroll (bodro) with CPP, EI, federal tax, and simplified British Columbia provincial tax (bi-weekly estimates).
        </p>
      </div>
      <PayrollContent
        structures={structures}
        perCompletedTiers={perCompletedTiers}
        payments={payments}
        personnel={personnel ?? []}
      />
    </div>
  )
}
