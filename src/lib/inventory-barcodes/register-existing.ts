import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { normalizeBarcodeCode } from './code-generator'
import type { InventoryBarcodeRow } from './types'

/** Re-register a printed AUR label whose row was deleted or never synced to this database. */
export async function registerExistingUnitBarcode(
  supabase: SupabaseClient,
  input: {
    code: string
    cameraModelId: string
    actorId: string | null
    note?: string
  }
): Promise<{ barcode?: InventoryBarcodeRow; error?: string }> {
  const code = normalizeBarcodeCode(input.code)
  if (!code) return { error: 'Enter a barcode code' }
  if (!input.cameraModelId) return { error: 'Select a camera model' }

  const { data: existing } = await supabase
    .from('inventory_barcodes')
    .select('id')
    .ilike('code', code)
    .maybeSingle()
  if (existing) return { error: 'This barcode code already exists in the registry' }

  const { data: model } = await supabase
    .from('camera_models')
    .select('id')
    .eq('id', input.cameraModelId)
    .maybeSingle()
  if (!model) return { error: 'Camera model not found' }

  const batchId = randomUUID()
  const { data: row, error } = await supabase
    .from('inventory_barcodes')
    .insert({
      code,
      kind: 'unit',
      camera_model_id: input.cameraModelId,
      batch_id: batchId,
      status: 'generated',
      created_by: input.actorId,
    })
    .select('*')
    .single()

  if (error || !row) return { error: error?.message ?? 'Failed to register barcode' }

  await supabase.from('inventory_barcode_events').insert({
    barcode_id: row.id,
    event_type: 'generated',
    actor_id: input.actorId,
    metadata: {
      kind: 'unit',
      batch_id: batchId,
      registered_existing_label: true,
      note: input.note?.trim() || null,
    },
  })

  return { barcode: row as InventoryBarcodeRow }
}
