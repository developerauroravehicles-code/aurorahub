import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { generateUniqueBarcodeCode } from './code-generator'
import { getBarcodeSettings } from './settings'
import type { InventoryBarcodeRow } from './types'

async function insertBarcodeEvent(
  supabase: SupabaseClient,
  barcodeId: string,
  eventType: string,
  actorId: string | null,
  metadata: Record<string, unknown> = {}
) {
  await supabase.from('inventory_barcode_events').insert({
    barcode_id: barcodeId,
    event_type: eventType,
    actor_id: actorId,
    metadata,
  })
}

export async function generateUnitBarcodes(
  supabase: SupabaseClient,
  input: {
    cameraModelId: string
    count: number
    createdBy: string | null
  }
): Promise<{ barcodes?: InventoryBarcodeRow[]; error?: string }> {
  if (input.count < 1 || input.count > 500) {
    return { error: 'Count must be between 1 and 500' }
  }

  const settings = await getBarcodeSettings(supabase)
  const batchId = randomUUID()
  const rows: Record<string, unknown>[] = []

  for (let i = 0; i < input.count; i++) {
    const code = await generateUniqueBarcodeCode(supabase, settings.codePrefix)
    rows.push({
      code,
      kind: 'unit',
      camera_model_id: input.cameraModelId,
      batch_id: batchId,
      status: 'generated',
      created_by: input.createdBy,
    })
  }

  const { data, error } = await supabase.from('inventory_barcodes').insert(rows).select('*')
  if (error) return { error: error.message }

  for (const row of data ?? []) {
    await insertBarcodeEvent(supabase, row.id, 'generated', input.createdBy, {
      kind: 'unit',
      batch_id: batchId,
    })
  }

  return { barcodes: (data ?? []) as InventoryBarcodeRow[] }
}

/**
 * Print unit labels for set template components only (no set container barcodes).
 * `setCount` multiplies each template line quantity (e.g. 2 sets → 2× Nova + 2× battery units).
 */
export async function generateUnitBarcodesForSetTemplate(
  supabase: SupabaseClient,
  input: {
    templateId: string
    setCount: number
    createdBy: string | null
  }
): Promise<{ barcodes?: InventoryBarcodeRow[]; error?: string }> {
  if (input.setCount < 1 || input.setCount > 100) {
    return { error: 'Count must be between 1 and 100' }
  }

  const { data: template } = await supabase
    .from('inventory_barcode_set_templates')
    .select('id, name, code')
    .eq('id', input.templateId)
    .maybeSingle()

  if (!template) return { error: 'Set template not found' }

  const { data: items } = await supabase
    .from('inventory_barcode_set_template_items')
    .select('camera_model_id, quantity')
    .eq('template_id', input.templateId)

  if (!items?.length) return { error: 'Set template has no items' }

  const settings = await getBarcodeSettings(supabase)
  const batchId = randomUUID()
  const allCreated: InventoryBarcodeRow[] = []

  for (let s = 0; s < input.setCount; s++) {
    for (const item of items) {
      const qty = Math.max(1, Number(item.quantity) || 1)
      for (let q = 0; q < qty; q++) {
        const unitCode = await generateUniqueBarcodeCode(supabase, settings.codePrefix)
        const { data: unitRow, error: unitError } = await supabase
          .from('inventory_barcodes')
          .insert({
            code: unitCode,
            kind: 'unit',
            camera_model_id: item.camera_model_id,
            set_template_id: input.templateId,
            batch_id: batchId,
            status: 'generated',
            created_by: input.createdBy,
          })
          .select('*')
          .single()

        if (unitError || !unitRow) {
          return { error: unitError?.message ?? 'Failed to create unit barcode' }
        }

        await insertBarcodeEvent(supabase, unitRow.id, 'generated', input.createdBy, {
          kind: 'unit',
          template_id: input.templateId,
          batch_id: batchId,
        })
        allCreated.push(unitRow as InventoryBarcodeRow)
      }
    }
  }

  return { barcodes: allCreated }
}
