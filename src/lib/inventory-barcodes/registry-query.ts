import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeBarcodeCode } from './code-generator'
import type { BarcodeTraceRow } from './trace'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBarcodeRegistryRow(row: Record<string, unknown>): BarcodeTraceRow {
  const dealersRaw = row.dealers as { name: string } | { name: string }[] | null
  const profilesRaw = row.profiles as { full_name: string } | { full_name: string }[] | null
  const cameraModelsRaw = row.camera_models as { name: string } | { name: string }[] | null
  const demandsRaw = row.demands as
    | {
        demand_number: string
        status: string
        customer_firstname: string
        customer_lastname: string
        customer_phone: string
      }
    | {
        demand_number: string
        status: string
        customer_firstname: string
        customer_lastname: string
        customer_phone: string
      }[]
    | null

  const dealers = Array.isArray(dealersRaw) ? dealersRaw[0] : dealersRaw
  const profiles = Array.isArray(profilesRaw) ? profilesRaw[0] : profilesRaw
  const cameraModels = Array.isArray(cameraModelsRaw) ? cameraModelsRaw[0] : cameraModelsRaw
  const demands = Array.isArray(demandsRaw) ? demandsRaw[0] : demandsRaw

  return {
    id: row.id as string,
    code: row.code as string,
    kind: row.kind as string,
    status: row.status as string,
    camera_model_id: row.camera_model_id as string | null,
    camera_model_name: cameraModels?.name ?? null,
    dealer_id: row.dealer_id as string | null,
    dealer_name: dealers?.name ?? null,
    specialist_id: row.specialist_id as string | null,
    specialist_name: profiles?.full_name ?? null,
    demand_id: row.demand_id as string | null,
    demand_number: demands?.demand_number ?? null,
    demand_status: demands?.status ?? null,
    customer_firstname: demands?.customer_firstname ?? null,
    customer_lastname: demands?.customer_lastname ?? null,
    customer_phone: demands?.customer_phone ?? null,
    consumed_at: row.consumed_at as string | null,
    batch_id: row.batch_id as string,
    parent_barcode_id: row.parent_barcode_id as string | null,
    created_at: row.created_at as string,
  }
}

const REGISTRY_SELECT = `
  id, code, kind, status, camera_model_id, dealer_id, specialist_id,
  demand_id, consumed_at, batch_id, parent_barcode_id, created_at,
  camera_models(name),
  dealers(name),
  profiles!inventory_barcodes_specialist_id_fkey(full_name),
  demands(demand_number, status, customer_firstname, customer_lastname, customer_phone)
`

export async function queryBarcodeRegistry(
  supabase: SupabaseClient,
  options: { search?: string; limit?: number; kind?: 'all' | 'unit' | 'set' } = {}
): Promise<BarcodeTraceRow[]> {
  const limit = options.limit ?? 300
  let query = supabase
    .from('inventory_barcodes')
    .select(REGISTRY_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options.kind === 'unit') query = query.eq('kind', 'unit')
  if (options.kind === 'set') query = query.eq('kind', 'set')

  const rawSearch = options.search?.trim()
  if (rawSearch) {
    const norm = normalizeBarcodeCode(rawSearch)
    if (norm.length >= 8 && !norm.includes('%')) {
      query = query.ilike('code', `%${norm}%`)
    } else {
      query = query.ilike('code', `%${rawSearch}%`)
    }
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapBarcodeRegistryRow(row as Record<string, unknown>))
}

export async function fetchBarcodeRegistryCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('inventory_barcodes')
    .select('id', { count: 'exact', head: true })

  if (error) return 0
  return count ?? 0
}

export type BarcodeRegistryAnomaly = {
  code: string
  kind: string
  status: string
  reason: string
}

export async function fetchBarcodeRegistryAnomalies(
  supabase: SupabaseClient,
  limit = 50
): Promise<BarcodeRegistryAnomaly[]> {
  const rows: BarcodeRegistryAnomaly[] = []

  const { data: legacySets } = await supabase
    .from('inventory_barcodes')
    .select('code, kind, status')
    .eq('kind', 'set')
    .neq('status', 'void')
    .limit(limit)

  for (const r of legacySets ?? []) {
    rows.push({
      code: r.code,
      kind: r.kind,
      status: r.status,
      reason: 'Legacy set container (hidden before; should be void or deleted)',
    })
  }

  const { data: missingModel } = await supabase
    .from('inventory_barcodes')
    .select('code, kind, status')
    .eq('kind', 'unit')
    .is('camera_model_id', null)
    .limit(limit)

  for (const r of missingModel ?? []) {
    rows.push({
      code: r.code,
      kind: r.kind,
      status: r.status,
      reason: 'Unit barcode missing camera model',
    })
  }

  return rows
}

export async function fetchBarcodeTraceByCode(
  supabase: SupabaseClient,
  code: string
): Promise<BarcodeTraceRow | null> {
  const norm = normalizeBarcodeCode(code)
  if (!norm) return null

  const { data, error } = await supabase
    .from('inventory_barcodes')
    .select(REGISTRY_SELECT)
    .ilike('code', norm)
    .maybeSingle()

  if (error || !data) return null
  return mapBarcodeRegistryRow(data as Record<string, unknown>)
}