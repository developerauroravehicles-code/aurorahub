'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  computeSpecialistPayEstimate,
  currentMonthPeriod,
  type SpecialistCompensationSnapshot,
  type SpecialistCompensationTier,
} from '@/lib/specialist-compensation'

async function ensureAmOrHr() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, userId: null, supabase: null }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['aurora_manager', 'hr'].includes(profile.role)) {
    return { error: 'Only Aurora Manager or HR can manage specialist compensation' as const, userId: null, supabase: null }
  }

  return { error: null, userId: user.id, supabase }
}

function activeTier(
  tiers: SpecialistCompensationTier[],
  periodEnd: string
): SpecialistCompensationTier | null {
  const end = periodEnd
  const match = tiers.find((t) => {
    const from = t.effective_from?.slice(0, 10) ?? ''
    const to = t.effective_to?.slice(0, 10) ?? null
    return from <= end && (!to || to >= end)
  })
  return match ?? tiers[0] ?? null
}

export async function getSpecialistCompensationSnapshot(
  profileId: string,
  periodStart?: string,
  periodEnd?: string
): Promise<{ error?: string; snapshot?: SpecialistCompensationSnapshot }> {
  const auth = await ensureAmOrHr()
  if (auth.error || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const period = currentMonthPeriod()
  const start = periodStart ?? period.start
  const end = periodEnd ?? period.end

  const supabase = auth.supabase

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', profileId)
    .single()

  if (!profile || profile.role !== 'specialist') {
    return { error: 'Specialist not found.' }
  }

  const { data: personnel } = await supabase
    .from('personnel')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle()

  const { data: statsRows } = await supabase.rpc('get_specialist_period_stats', {
    p_profile_ids: [profileId],
    p_period_start: start,
    p_period_end: end,
  })

  const stats = (statsRows as Array<{
    profile_id: string
    installations_completed: number
    service_jobs_completed: number
    service_fee_total: number
    expense_reimbursement_total: number
    manual_items_total: number
  }> | null)?.[0]

  let tier: SpecialistCompensationTier | null = null
  if (personnel?.id) {
    const { data: tiers } = await supabase
      .from('compensation_per_completed')
      .select('id, base_completed, base_amount, per_completed_amount, currency, effective_from, effective_to')
      .eq('personnel_id', personnel.id)
      .order('effective_from', { ascending: false })

    tier = activeTier((tiers ?? []) as SpecialistCompensationTier[], end)
  }

  const { data: manualRows } = await supabase
    .from('specialist_manual_payroll_items')
    .select('id, label, amount, notes, created_at')
    .eq('profile_id', profileId)
    .eq('period_start', start)
    .eq('period_end', end)
    .order('created_at', { ascending: false })

  const manualItems = (manualRows ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    amount: Number(r.amount),
    notes: r.notes ?? '',
    created_at: r.created_at,
  }))

  const payCalc = computeSpecialistPayEstimate({
    installationsCompleted: Number(stats?.installations_completed ?? 0),
    tier,
    serviceFeeTotal: Number(stats?.service_fee_total ?? 0),
    expenseReimbTotal: Number(stats?.expense_reimbursement_total ?? 0),
    manualItems: manualItems.map((m) => ({ id: m.id, label: m.label, amount: m.amount })),
  })

  return {
    snapshot: {
      profile_id: profileId,
      personnel_id: personnel?.id ?? null,
      period_start: start,
      period_end: end,
      installations_completed: Number(stats?.installations_completed ?? 0),
      service_jobs_completed: Number(stats?.service_jobs_completed ?? 0),
      tier,
      manual_items: manualItems,
      ...payCalc,
    },
  }
}

export async function getSpecialistStatsBatch(
  profileIds: string[],
  periodStart?: string,
  periodEnd?: string
): Promise<
  Map<
    string,
    {
      installations_completed: number
      service_jobs_completed: number
      estimated_net: number
    }
  >
> {
  const auth = await ensureAmOrHr()
  const result = new Map<
    string,
    { installations_completed: number; service_jobs_completed: number; estimated_net: number }
  >()
  if (auth.error || !auth.supabase || profileIds.length === 0) return result

  const period = currentMonthPeriod()
  const start = periodStart ?? period.start
  const end = periodEnd ?? period.end

  const { data: statsRows } = await auth.supabase.rpc('get_specialist_period_stats', {
    p_profile_ids: profileIds,
    p_period_start: start,
    p_period_end: end,
  })

  for (const row of (statsRows ?? []) as Array<{
    profile_id: string
    installations_completed: number
    service_jobs_completed: number
    service_fee_total: number
    expense_reimbursement_total: number
    manual_items_total: number
  }>) {
    const { snapshot } = await getSpecialistCompensationSnapshot(row.profile_id, start, end)
    result.set(row.profile_id, {
      installations_completed: Number(row.installations_completed ?? 0),
      service_jobs_completed: Number(row.service_jobs_completed ?? 0),
      estimated_net: snapshot?.estimated_net ?? 0,
    })
  }

  return result
}

export async function addSpecialistManualPayrollItem(
  profileId: string,
  label: string,
  amount: number,
  periodStart: string,
  periodEnd: string,
  notes?: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await ensureAmOrHr()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const parsed = Math.round(parseFloat(String(amount)) * 100) / 100
  if (!Number.isFinite(parsed) || parsed <= 0) return { error: 'Enter a valid amount.' }

  const trimmedLabel = label.trim().slice(0, 120)
  if (!trimmedLabel) return { error: 'Label is required.' }

  const { error } = await auth.supabase.from('specialist_manual_payroll_items').insert({
    profile_id: profileId,
    label: trimmedLabel,
    amount: parsed,
    period_start: periodStart,
    period_end: periodEnd,
    notes: (notes ?? '').trim().slice(0, 300),
    created_by: auth.userId,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/employees')
  revalidatePath(`/dashboard/admin/employees/${profileId}`)
  return { success: true }
}

export async function deleteSpecialistManualPayrollItem(
  itemId: string,
  profileId: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await ensureAmOrHr()
  if (auth.error || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const { error } = await auth.supabase
    .from('specialist_manual_payroll_items')
    .delete()
    .eq('id', itemId)
    .eq('profile_id', profileId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/employees')
  revalidatePath(`/dashboard/admin/employees/${profileId}`)
  return { success: true }
}

export async function getSpecialistStatsForList(
  profileIds: string[]
): Promise<
  Record<
    string,
    {
      installations_completed: number
      service_jobs_completed: number
      service_earnings: number
      manual_total: number
    }
  >
> {
  const auth = await ensureAmOrHr()
  if (auth.error || !auth.supabase || profileIds.length === 0) return {}

  const period = currentMonthPeriod()
  const { data: statsRows } = await auth.supabase.rpc('get_specialist_period_stats', {
    p_profile_ids: profileIds,
    p_period_start: period.start,
    p_period_end: period.end,
  })

  const out: Record<
    string,
    {
      installations_completed: number
      service_jobs_completed: number
      service_earnings: number
      manual_total: number
    }
  > = {}

  for (const row of (statsRows ?? []) as Array<{
    profile_id: string
    installations_completed: number
    service_jobs_completed: number
    service_fee_total: number
    expense_reimbursement_total: number
    manual_items_total: number
  }>) {
    out[row.profile_id] = {
      installations_completed: Number(row.installations_completed ?? 0),
      service_jobs_completed: Number(row.service_jobs_completed ?? 0),
      service_earnings:
        Number(row.service_fee_total ?? 0) + Number(row.expense_reimbursement_total ?? 0),
      manual_total: Number(row.manual_items_total ?? 0),
    }
  }

  return out
}
