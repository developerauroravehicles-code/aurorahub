import type { SupabaseClient } from '@supabase/supabase-js'

export type BarcodeCodesByDemandId = Record<string, string[]>

const DEMAND_ID_CHUNK = 200

/** Barcode codes linked to demands (for All Demands smart search). */
export async function fetchBarcodeCodesByDemandIds(
  supabase: SupabaseClient,
  demandIds: string[]
): Promise<BarcodeCodesByDemandId> {
  const index: BarcodeCodesByDemandId = {}
  if (!demandIds.length) return index

  for (let i = 0; i < demandIds.length; i += DEMAND_ID_CHUNK) {
    const chunk = demandIds.slice(i, i + DEMAND_ID_CHUNK)
    const { data, error } = await supabase
      .from('inventory_barcodes')
      .select('demand_id, code')
      .in('demand_id', chunk)

    if (error) throw error

    for (const row of data ?? []) {
      const demandId = row.demand_id as string | null
      const code = row.code as string | null
      if (!demandId || !code?.trim()) continue
      index[demandId] = index[demandId] ?? []
      index[demandId].push(code)
    }
  }

  return index
}
