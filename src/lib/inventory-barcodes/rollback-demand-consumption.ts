import type { SupabaseClient } from '@supabase/supabase-js'
import { releaseConsumedBarcode } from './release-consumed'

/** Undo barcode consumes for a demand (e.g. failed external demand after partial scan). */
export async function rollbackDemandBarcodeConsumption(
  adminSupabase: SupabaseClient,
  input: {
    demandId: string
    actorId: string | null
    reason?: string
  }
): Promise<{ error?: string }> {
  const reason =
    input.reason?.trim() ||
    'Automatic rollback: barcode consume batch failed or demand creation aborted'

  const { data: barcodes, error: listError } = await adminSupabase
    .from('inventory_barcodes')
    .select('id, code')
    .eq('demand_id', input.demandId)
    .eq('status', 'consumed')

  if (listError) return { error: listError.message }

  for (const row of barcodes ?? []) {
    const result = await releaseConsumedBarcode(adminSupabase, {
      barcodeId: row.id,
      actorId: input.actorId,
      reason: `${reason} (${row.code})`,
    })
    if (result.error) return { error: result.error }
  }

  return {}
}
