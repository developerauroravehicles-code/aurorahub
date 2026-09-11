import type { SupabaseClient } from '@supabase/supabase-js'
import { isBarcodeModeEnabled } from '@/lib/inventory-barcodes/settings'

export const BARCODE_MODE_QUANTITY_BLOCKED_MESSAGE =
  'Barcode mode is active. Use the Barcode tab to generate, assign, and track cameras by scan. Manual quantity movements are disabled (adjustments for corrections are still allowed).'

export async function assertQuantityMovementAllowed(
  supabase: SupabaseClient,
  kind: 'movement' | 'adjustment' = 'movement'
): Promise<{ error?: string }> {
  const enabled = await isBarcodeModeEnabled(supabase)
  if (!enabled) return {}
  if (kind === 'adjustment') return {}
  return { error: BARCODE_MODE_QUANTITY_BLOCKED_MESSAGE }
}
