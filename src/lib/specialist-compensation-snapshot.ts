import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeSpecialistPayEstimate,
  currentMonthPeriod,
  SPECIALIST_RATES,
  type SpecialistCompensationSnapshot,
  type SpecialistPayRates,
} from '@/lib/specialist-compensation'
import {
  mapPaymentTypeToCompensation,
  mapSalaryFieldsToCompensation,
  type ResolvedPersonnelCompensation,
} from '@/lib/personnel-compensation'

export type PeriodStatsRow = {
  profile_id: string
  installations_completed: number
  removals_completed: number
  transfers_completed: number
  delay_30min_count: number
  delay_60min_count: number
  service_jobs_completed: number
  service_fee_total: number
  expense_reimbursement_total: number
  manual_items_total: number
  expense_claims_total: number
}

export type SpecialistCompensationInputs = {
  rates: SpecialistPayRates
  compensation: ResolvedPersonnelCompensation | null
}

function manualItemsFromStats(
  stats: PeriodStatsRow | undefined,
  manualItems: SpecialistCompensationSnapshot['manual_items']
): SpecialistCompensationSnapshot['manual_items'] {
  if (manualItems.length > 0) return manualItems
  const total = Number(stats?.manual_items_total ?? 0)
  if (total > 0) {
    return [{ id: 'manual-total', label: 'Manual adjustments', amount: total, notes: '', created_at: '' }]
  }
  return []
}

function tierToCompensation(tier: {
  base_completed: number
  base_amount: number
  per_completed_amount: number
}): ResolvedPersonnelCompensation {
  return {
    payMode: 'tiered',
    rates: {
      ...SPECIALIST_RATES,
      baseCompleted: Number(tier.base_completed),
      baseAmountCad: Number(tier.base_amount),
      perExtraCad: Number(tier.per_completed_amount),
    },
    paymentTypeLabel: 'Per completed (tiered)',
  }
}

export async function fetchSpecialistCompensationInputs(
  supabase: SupabaseClient,
  profileId: string,
  periodStart: string,
  periodEnd: string
): Promise<SpecialistCompensationInputs> {
  const defaultRates: SpecialistPayRates = { ...SPECIALIST_RATES }

  const { data: personnel } = await supabase
    .from('personnel')
    .select('id, salary_amount, salary_type')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (!personnel) {
    return { rates: defaultRates, compensation: null }
  }

  const salaryAmount = personnel.salary_amount != null ? Number(personnel.salary_amount) : null
  if (salaryAmount != null && salaryAmount > 0) {
    const fromPersonnel = mapSalaryFieldsToCompensation(
      salaryAmount,
      personnel.salary_type as string | null,
      periodStart,
      periodEnd,
      defaultRates
    )
    if (fromPersonnel) {
      return { rates: fromPersonnel.rates, compensation: fromPersonnel }
    }
  }

  const { data: tiers } = await supabase
    .from('compensation_per_completed')
    .select('base_completed, base_amount, per_completed_amount, effective_from, effective_to')
    .eq('personnel_id', personnel.id)
    .lte('effective_from', periodEnd)
    .or(`effective_to.is.null,effective_to.gte.${periodStart}`)
    .order('effective_from', { ascending: false })
    .limit(1)

  const activeTier = tiers?.[0]
  if (activeTier) {
    const fromTier = tierToCompensation(activeTier)
    return { rates: fromTier.rates, compensation: fromTier }
  }

  const { data: structures } = await supabase
    .from('compensation_structures')
    .select('payment_type, amount, effective_from, effective_to')
    .eq('personnel_id', personnel.id)
    .lte('effective_from', periodEnd)
    .or(`effective_to.is.null,effective_to.gte.${periodStart}`)
    .order('effective_from', { ascending: false })
    .limit(1)

  const activeStructure = structures?.[0]
  if (activeStructure && activeStructure.payment_type !== 'per_completed_tiered') {
    const fromStructure = mapPaymentTypeToCompensation(
      activeStructure.payment_type as string,
      activeStructure.amount != null ? Number(activeStructure.amount) : null,
      periodStart,
      periodEnd,
      defaultRates
    )
    if (fromStructure) {
      return { rates: fromStructure.rates, compensation: fromStructure }
    }
  }

  return { rates: defaultRates, compensation: null }
}

/** @deprecated use fetchSpecialistCompensationInputs */
export async function fetchSpecialistPayRates(
  supabase: SupabaseClient,
  profileId: string,
  periodStart: string,
  periodEnd: string
): Promise<SpecialistPayRates> {
  const inputs = await fetchSpecialistCompensationInputs(supabase, profileId, periodStart, periodEnd)
  return inputs.rates
}

async function loadApprovedExpenseClaims(
  supabase: SupabaseClient,
  profileId: string,
  start: string,
  end: string
): Promise<{ id: string; label: string; amount: number }[]> {
  const { data } = await supabase
    .from('specialist_expense_claims')
    .select('id, description, amount')
    .eq('profile_id', profileId)
    .eq('status', 'approved')
    .gte('expense_date', start)
    .lte('expense_date', end)
    .order('expense_date', { ascending: true })

  return (data ?? []).map((r) => ({
    id: r.id,
    label: r.description,
    amount: Number(r.amount),
  }))
}

export function buildSpecialistCompensationSnapshot(
  profileId: string,
  start: string,
  end: string,
  stats: PeriodStatsRow | undefined,
  manualItems: SpecialistCompensationSnapshot['manual_items'],
  expenseClaims: { id: string; label: string; amount: number }[],
  inputs: SpecialistCompensationInputs = { rates: SPECIALIST_RATES, compensation: null }
): SpecialistCompensationSnapshot {
  const resolvedManual = manualItemsFromStats(stats, manualItems)
  const resolvedClaims =
    expenseClaims.length > 0
      ? expenseClaims
      : Number(stats?.expense_claims_total ?? 0) > 0
        ? [
            {
              id: 'expense-claims-aggregate',
              label: 'Approved expense claims',
              amount: Number(stats?.expense_claims_total),
            },
          ]
        : []
  const payCalc = computeSpecialistPayEstimate({
    installationsCompleted: Number(stats?.installations_completed ?? 0),
    removalsCompleted: Number(stats?.removals_completed ?? 0),
    transfersCompleted: Number(stats?.transfers_completed ?? 0),
    delay30minCount: Number(stats?.delay_30min_count ?? 0),
    delay60minCount: Number(stats?.delay_60min_count ?? 0),
    serviceFeeTotal: Number(stats?.service_fee_total ?? 0),
    expenseReimbTotal: Number(stats?.expense_reimbursement_total ?? 0),
    expenseClaims: resolvedClaims,
    manualItems: resolvedManual.map((m) => ({ id: m.id, label: m.label, amount: m.amount })),
    rates: inputs.rates,
    compensation: inputs.compensation,
  })

  return {
    profile_id: profileId,
    period_start: start,
    period_end: end,
    installations_completed: Number(stats?.installations_completed ?? 0),
    removals_completed: Number(stats?.removals_completed ?? 0),
    transfers_completed: Number(stats?.transfers_completed ?? 0),
    delay_30min_count: Number(stats?.delay_30min_count ?? 0),
    delay_60min_count: Number(stats?.delay_60min_count ?? 0),
    service_jobs_completed: Number(stats?.service_jobs_completed ?? 0),
    manual_items: resolvedManual.filter((m) => m.id !== 'manual-total'),
    compensation_basis: inputs.compensation,
    ...payCalc,
  }
}

export async function fetchSpecialistCompensationSnapshot(
  supabase: SupabaseClient,
  profileId: string,
  periodStart?: string,
  periodEnd?: string
): Promise<SpecialistCompensationSnapshot> {
  const period = currentMonthPeriod()
  const start = periodStart ?? period.start
  const end = periodEnd ?? period.end

  const { data: statsRows } = await supabase.rpc('get_specialist_period_stats', {
    p_profile_ids: [profileId],
    p_period_start: start,
    p_period_end: end,
  })

  const stats = (statsRows as PeriodStatsRow[] | null)?.[0]

  const [manualRows, expenseClaims, inputs] = await Promise.all([
    supabase
      .from('specialist_manual_payroll_items')
      .select('id, label, amount, notes, created_at')
      .eq('profile_id', profileId)
      .eq('period_start', start)
      .eq('period_end', end)
      .order('created_at', { ascending: false }),
    loadApprovedExpenseClaims(supabase, profileId, start, end),
    fetchSpecialistCompensationInputs(supabase, profileId, start, end),
  ])

  const manualItems = (manualRows.data ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    amount: Number(r.amount),
    notes: r.notes ?? '',
    created_at: r.created_at,
  }))

  return buildSpecialistCompensationSnapshot(profileId, start, end, stats, manualItems, expenseClaims, inputs)
}
