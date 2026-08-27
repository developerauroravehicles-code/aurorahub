import type { SupabaseClient } from '@supabase/supabase-js'

export async function getDealerIdsInPool(
  supabase: SupabaseClient,
  poolId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('dealers')
    .select('id')
    .eq('scheduling_pool_id', poolId)

  return (data ?? []).map((d) => d.id)
}

export async function getSpecialistIdsInPool(
  supabase: SupabaseClient,
  poolId: string
): Promise<string[]> {
  const dealerIds = await getDealerIdsInPool(supabase, poolId)
  if (dealerIds.length === 0) return []

  const { data: links } = await supabase
    .from('specialist_dealers')
    .select('specialist_id')
    .in('dealer_id', dealerIds)

  return [...new Set((links ?? []).map((l) => l.specialist_id))]
}

async function ensureSpecialistProfile(
  supabase: SupabaseClient,
  specialistId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', specialistId)
    .maybeSingle()

  if (!profile || profile.role !== 'specialist') {
    return { ok: false, error: 'Selected user is not a specialist' }
  }

  return { ok: true }
}

export async function assignSpecialistToDealers(
  supabase: SupabaseClient,
  specialistId: string,
  dealerIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (dealerIds.length === 0) return { success: true }

  const check = await ensureSpecialistProfile(supabase, specialistId)
  if (!check.ok) return { success: false, error: check.error }

  const rows = dealerIds.map((dealer_id) => ({
    specialist_id: specialistId,
    dealer_id,
  }))

  const { error } = await supabase
    .from('specialist_dealers')
    .upsert(rows, { onConflict: 'specialist_id,dealer_id', ignoreDuplicates: true })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function removeSpecialistFromDealers(
  supabase: SupabaseClient,
  specialistId: string,
  dealerIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (dealerIds.length === 0) return { success: true }

  const { error } = await supabase
    .from('specialist_dealers')
    .delete()
    .eq('specialist_id', specialistId)
    .in('dealer_id', dealerIds)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function assignSpecialistToPool(
  supabase: SupabaseClient,
  poolId: string,
  specialistId: string
): Promise<{ success: boolean; error?: string }> {
  const dealerIds = await getDealerIdsInPool(supabase, poolId)
  if (dealerIds.length === 0) {
    return {
      success: false,
      error: 'Add at least one dealer to this pool before assigning specialists.',
    }
  }

  return assignSpecialistToDealers(supabase, specialistId, dealerIds)
}

export async function removeSpecialistFromPool(
  supabase: SupabaseClient,
  poolId: string,
  specialistId: string
): Promise<{ success: boolean; error?: string }> {
  const dealerIds = await getDealerIdsInPool(supabase, poolId)
  return removeSpecialistFromDealers(supabase, specialistId, dealerIds)
}

export async function syncDealerSchedulingPoolSpecialists(
  supabase: SupabaseClient,
  dealerId: string,
  previousPoolId: string | null,
  newPoolId: string | null
): Promise<{ success: boolean; error?: string }> {
  if (previousPoolId && previousPoolId !== newPoolId) {
    const oldSpecialists = await getSpecialistIdsInPool(supabase, previousPoolId)
    for (const specialistId of oldSpecialists) {
      const result = await removeSpecialistFromDealers(supabase, specialistId, [dealerId])
      if (!result.success) return result
    }
  }

  if (newPoolId && newPoolId !== previousPoolId) {
    const newSpecialists = await getSpecialistIdsInPool(supabase, newPoolId)
    for (const specialistId of newSpecialists) {
      const result = await assignSpecialistToDealers(supabase, specialistId, [dealerId])
      if (!result.success) return result
    }
  }

  return { success: true }
}
