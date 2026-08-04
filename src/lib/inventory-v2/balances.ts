import type { SupabaseClient } from '@supabase/supabase-js'
import type { InventoryBalanceRow } from './types'

export async function getBalanceAtLocation(
  supabase: SupabaseClient,
  locationId: string,
  cameraModelId: string
): Promise<number> {
  const { data } = await supabase
    .from('inventory_balances_v2')
    .select('quantity')
    .eq('location_id', locationId)
    .eq('camera_model_id', cameraModelId)
    .maybeSingle()
  const q = data?.quantity
  if (q == null) return 0
  return typeof q === 'string' ? parseInt(q, 10) : Number(q)
}

export async function fetchAllBalances(supabase: SupabaseClient): Promise<InventoryBalanceRow[]> {
  const { data } = await supabase
    .from('inventory_balances_v2')
    .select('location_id, location_type, label, camera_model_id, quantity')
  return (data ?? []).map((row) => ({
    location_id: row.location_id as string,
    location_type: row.location_type as InventoryBalanceRow['location_type'],
    label: row.label as string,
    camera_model_id: row.camera_model_id as string,
    quantity:
      typeof row.quantity === 'string' ? parseInt(row.quantity, 10) : Number(row.quantity ?? 0),
  }))
}

export async function fetchBalancesForLocation(
  supabase: SupabaseClient,
  locationId: string
): Promise<{ camera_model_id: string; quantity: number }[]> {
  const { data } = await supabase
    .from('inventory_balances_v2')
    .select('camera_model_id, quantity')
    .eq('location_id', locationId)
  return (data ?? []).map((row) => ({
    camera_model_id: row.camera_model_id as string,
    quantity:
      typeof row.quantity === 'string' ? parseInt(row.quantity, 10) : Number(row.quantity ?? 0),
  }))
}

export function balanceMap(rows: InventoryBalanceRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.camera_model_id) continue
    const key = `${row.location_id}:${row.camera_model_id}`
    map.set(key, row.quantity)
  }
  return map
}

export function sumBalancesByModel(rows: InventoryBalanceRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.camera_model_id) continue
    map.set(row.camera_model_id, (map.get(row.camera_model_id) ?? 0) + row.quantity)
  }
  return map
}
