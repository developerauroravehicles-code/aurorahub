'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  currentMonthPeriod,
  type SpecialistCompensationSnapshot,
} from '@/lib/specialist-compensation'
import {
  buildSpecialistCompensationSnapshot,
  fetchSpecialistCompensationSnapshot,
  fetchSpecialistPayRates,
  type PeriodStatsRow,
} from '@/lib/specialist-compensation-snapshot'

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

export async function getSpecialistCompensationSnapshot(
  profileId: string,
  periodStart?: string,
  periodEnd?: string
): Promise<{ error?: string; snapshot?: SpecialistCompensationSnapshot }> {
  const auth = await ensureAmOrHr()
  if (auth.error || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', profileId)
    .single()

  if (!profile || profile.role !== 'specialist') {
    return { error: 'Specialist not found.' }
  }

  const snapshot = await fetchSpecialistCompensationSnapshot(
    auth.supabase,
    profileId,
    periodStart,
    periodEnd
  )

  return { snapshot }
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
      estimated_net_cad: number
      estimated_delay_usd: number
    }
  >
> {
  const auth = await ensureAmOrHr()
  const result = new Map<
    string,
    {
      installations_completed: number
      service_jobs_completed: number
      estimated_net_cad: number
      estimated_delay_usd: number
    }
  >()
  if (auth.error || !auth.supabase || profileIds.length === 0) return result

  const period = currentMonthPeriod()
  const start = periodStart ?? period.start
  const end = periodEnd ?? period.end

  for (const profileId of profileIds) {
    const snapshot = await fetchSpecialistCompensationSnapshot(auth.supabase, profileId, start, end)
    result.set(profileId, {
      installations_completed: snapshot.installations_completed,
      service_jobs_completed: snapshot.service_jobs_completed,
      estimated_net_cad: snapshot.estimated_net_cad,
      estimated_delay_usd: snapshot.estimated_delay_usd,
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
  revalidatePath('/dashboard/self')
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
  revalidatePath('/dashboard/self')
  return { success: true }
}

export async function getSpecialistStatsForList(
  profileIds: string[]
): Promise<
  Record<
    string,
    {
      installations_completed: number
      removals_completed: number
      transfers_completed: number
      service_jobs_completed: number
      estimated_net_cad: number
      estimated_delay_usd: number
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
      removals_completed: number
      transfers_completed: number
      service_jobs_completed: number
      estimated_net_cad: number
      estimated_delay_usd: number
    }
  > = {}

  for (const row of (statsRows ?? []) as PeriodStatsRow[]) {
    const rates = await fetchSpecialistPayRates(auth.supabase, row.profile_id, period.start, period.end)
    const snapshot = buildSpecialistCompensationSnapshot(
      row.profile_id,
      period.start,
      period.end,
      row,
      [],
      [],
      rates
    )
    out[row.profile_id] = {
      installations_completed: snapshot.installations_completed,
      removals_completed: snapshot.removals_completed,
      transfers_completed: snapshot.transfers_completed,
      service_jobs_completed: snapshot.service_jobs_completed,
      estimated_net_cad: snapshot.estimated_net_cad,
      estimated_delay_usd: snapshot.estimated_delay_usd,
    }
  }

  return out
}
