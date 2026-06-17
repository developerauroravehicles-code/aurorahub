import type { SupabaseClient } from '@supabase/supabase-js'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import {
  calculateDemandInvoiceAmount,
  type DemandServiceType,
  isDemandServiceType,
} from '@/lib/demand-pricing'

/** Pacific calendar date (yyyy-MM-dd) from an ISO timestamp. */
export function ptDateFromIso(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return formatInTimeZone(d, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
}

export function ptTodayDate(): string {
  return formatInTimeZone(new Date(), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
}

export async function getOrCreateDailyBatch(
  supabase: SupabaseClient,
  dealerId: string,
  batchDate: string
): Promise<{ batchId: string } | { error: string }> {
  const { data: existing } = await supabase
    .from('dealer_daily_invoice_batches')
    .select('id')
    .eq('dealer_id', dealerId)
    .eq('batch_date', batchDate)
    .maybeSingle()

  if (existing?.id) {
    return { batchId: existing.id }
  }

  const { data: created, error } = await supabase
    .from('dealer_daily_invoice_batches')
    .insert({ dealer_id: dealerId, batch_date: batchDate, status: 'open' })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: retry } = await supabase
        .from('dealer_daily_invoice_batches')
        .select('id')
        .eq('dealer_id', dealerId)
        .eq('batch_date', batchDate)
        .maybeSingle()
      if (retry?.id) return { batchId: retry.id }
    }
    return { error: error.message }
  }

  return { batchId: created.id }
}

/**
 * Idempotently attach a completed demand to its dealer's PT daily batch.
 * Uses admin client (bypasses RLS) — call from server actions after completion.
 */
export async function addDemandToDailyBatch(
  supabase: SupabaseClient,
  demandId: string
): Promise<{ ok: true } | { error: string }> {
  const { data: demand, error: demandError } = await supabase
    .from('demands')
    .select('id, dealer_id, status, completed_at, updated_at')
    .eq('id', demandId)
    .single()

  if (demandError || !demand) {
    return { error: demandError?.message ?? 'Demand not found' }
  }
  if (demand.status !== 'completed') {
    return { ok: true }
  }
  if (!demand.dealer_id) {
    return { ok: true }
  }

  const completedIso = demand.completed_at ?? demand.updated_at
  if (!completedIso) {
    return { error: 'Completed demand has no completion timestamp' }
  }

  const batchDate = ptDateFromIso(completedIso)
  const batchResult = await getOrCreateDailyBatch(supabase, demand.dealer_id, batchDate)
  if ('error' in batchResult) {
    return { error: batchResult.error }
  }

  const { count } = await supabase
    .from('dealer_daily_invoice_batch_items')
    .select('demand_id', { count: 'exact', head: true })
    .eq('batch_id', batchResult.batchId)

  const sortOrder = count ?? 0

  const { error: itemError } = await supabase.from('dealer_daily_invoice_batch_items').insert({
    batch_id: batchResult.batchId,
    demand_id: demandId,
    included: true,
    sort_order: sortOrder,
  })

  if (itemError) {
    if (itemError.code === '23505') {
      return { ok: true }
    }
    return { error: itemError.message }
  }

  return { ok: true }
}

/** All completed demand ids whose completion falls on the given PT calendar date. */
export async function getCompletedDemandIdsForPtDate(
  supabase: SupabaseClient,
  batchDate: string
): Promise<string[]> {
  const { data } = await supabase
    .from('demands')
    .select('id, completed_at, updated_at')
    .eq('status', 'completed')
    .not('dealer_id', 'is', null)

  const ids: string[] = []
  for (const row of data ?? []) {
    const iso = (row.completed_at ?? row.updated_at) as string | null
    if (!iso) continue
    if (ptDateFromIso(iso) === batchDate) ids.push(row.id as string)
  }
  return ids
}

/** Ensure demand is linked to the batch for its PT completion date (moves if on wrong day). */
async function ensureDemandOnDailyBatchForDate(
  supabase: SupabaseClient,
  demandId: string,
  batchDate: string
): Promise<{ ok: true } | { error: string }> {
  const { data: demand, error: demandError } = await supabase
    .from('demands')
    .select('id, dealer_id, status, completed_at, updated_at')
    .eq('id', demandId)
    .single()

  if (demandError || !demand) {
    return { error: demandError?.message ?? 'Demand not found' }
  }
  if (demand.status !== 'completed' || !demand.dealer_id) {
    return { ok: true }
  }

  const completedIso = demand.completed_at ?? demand.updated_at
  if (!completedIso) {
    return { error: 'Completed demand has no completion timestamp' }
  }
  if (ptDateFromIso(completedIso) !== batchDate) {
    return { ok: true }
  }

  const { data: existingItem } = await supabase
    .from('dealer_daily_invoice_batch_items')
    .select('batch_id, dealer_daily_invoice_batches(batch_date)')
    .eq('demand_id', demandId)
    .maybeSingle()

  if (existingItem) {
    const batchRaw = existingItem.dealer_daily_invoice_batches
    const batchMeta = Array.isArray(batchRaw) ? batchRaw[0] : batchRaw
    const existingDate = (batchMeta as { batch_date?: string } | null)?.batch_date
    if (existingDate === batchDate) {
      return { ok: true }
    }
    await supabase.from('dealer_daily_invoice_batch_items').delete().eq('demand_id', demandId)
  }

  return addDemandToDailyBatch(supabase, demandId)
}

/** Backfill service_type and invoice_total_amount for historical completed demands. */
async function backfillDemandInvoiceFields(
  supabase: SupabaseClient,
  demandId: string
): Promise<void> {
  const { data: demand } = await supabase
    .from('demands')
    .select(
      'id, status, dealer_id, service_type, invoice_total_amount, camera_model, camera_model_id'
    )
    .eq('id', demandId)
    .maybeSingle()

  if (!demand || demand.status !== 'completed' || !demand.dealer_id) return

  const serviceType: DemandServiceType =
    demand.service_type && isDemandServiceType(demand.service_type)
      ? demand.service_type
      : 'installation'

  const updates: Record<string, unknown> = {}
  if (!demand.service_type) updates.service_type = serviceType

  if (demand.invoice_total_amount == null) {
    const pricing = await calculateDemandInvoiceAmount(supabase, {
      dealerId: demand.dealer_id as string,
      cameraModelId: (demand.camera_model_id as string | null) ?? null,
      cameraModelName: (demand.camera_model as string | null) ?? null,
      serviceType,
    })
    if ('amount' in pricing) updates.invoice_total_amount = pricing.amount
  }

  if (Object.keys(updates).length === 0) return

  await supabase.from('demands').update(updates).eq('id', demandId)
}

async function cleanupEmptyBatchesForDate(
  supabase: SupabaseClient,
  batchDate: string
): Promise<void> {
  const { data: batches } = await supabase
    .from('dealer_daily_invoice_batches')
    .select('id')
    .eq('batch_date', batchDate)

  for (const batch of batches ?? []) {
    const { count } = await supabase
      .from('dealer_daily_invoice_batch_items')
      .select('demand_id', { count: 'exact', head: true })
      .eq('batch_id', batch.id as string)

    if ((count ?? 0) === 0) {
      await supabase.from('dealer_daily_invoice_batches').delete().eq('id', batch.id as string)
    }
  }
}

/**
 * Ensure all completed demands for a PT calendar day have batch rows.
 * Backfills historical completions that pre-date the daily-invoices feature or missed hooks.
 */
export async function syncDailyBatchesForPtDate(
  supabase: SupabaseClient,
  batchDate: string
): Promise<{ synced: number; errors: number; completedCount: number }> {
  const demandIds = await getCompletedDemandIdsForPtDate(supabase, batchDate)

  let synced = 0
  let errors = 0
  for (const demandId of demandIds) {
    await backfillDemandInvoiceFields(supabase, demandId)
    const result = await ensureDemandOnDailyBatchForDate(supabase, demandId, batchDate)
    if ('error' in result) errors += 1
    else synced += 1
  }

  await cleanupEmptyBatchesForDate(supabase, batchDate)

  return { synced, errors, completedCount: demandIds.length }
}
