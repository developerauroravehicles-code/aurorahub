import type { SupabaseClient } from '@supabase/supabase-js'

export type SetTemplateRow = {
  booking_camera_model_id: string | null
  items: { camera_model_id: string; quantity: number }[]
}

/** Multiset match: scanned unit model ids match set template line quantities (order-independent). */
export function scannedUnitsMatchSetTemplate(
  scannedModelIds: string[],
  items: { camera_model_id: string; quantity: number }[]
): boolean {
  if (!items.length || !scannedModelIds.length) return false

  const required = new Map<string, number>()
  for (const item of items) {
    const id = item.camera_model_id
    const q = Math.max(1, Number(item.quantity) || 1)
    required.set(id, (required.get(id) ?? 0) + q)
  }

  const scanned = new Map<string, number>()
  for (const id of scannedModelIds) {
    scanned.set(id, (scanned.get(id) ?? 0) + 1)
  }

  if (required.size !== scanned.size) return false
  for (const [id, need] of required) {
    if (scanned.get(id) !== need) return false
  }
  return true
}

/**
 * When multiple unit barcodes match a set template, return the set's booking catalog model.
 * Falls back to a single scanned model when only one distinct unit was scanned.
 */
export async function inferBookingCameraFromScannedUnits(
  supabase: SupabaseClient,
  unitCameraModelIds: string[]
): Promise<{ cameraModelId: string; cameraModelName: string } | null> {
  const ids = unitCameraModelIds.filter(Boolean)
  if (!ids.length) return null

  const { data: templates, error: tErr } = await supabase
    .from('inventory_barcode_set_templates')
    .select(
      `
      booking_camera_model_id,
      inventory_barcode_set_template_items(camera_model_id, quantity)
    `
    )

  if (tErr || !templates?.length) {
    return fallbackSingleModel(supabase, ids)
  }

  for (const row of templates) {
    const bookingId = row.booking_camera_model_id as string | null
    if (!bookingId) continue

    const rawItems = row.inventory_barcode_set_template_items as
      | { camera_model_id: string; quantity: number }[]
      | { camera_model_id: string; quantity: number }
      | null
    const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []
    if (!items.length) continue

    if (!scannedUnitsMatchSetTemplate(ids, items)) continue

    const { data: cam } = await supabase
      .from('camera_models')
      .select('id, name, is_active')
      .eq('id', bookingId)
      .maybeSingle()

    if (cam?.id && cam.is_active !== false) {
      return { cameraModelId: cam.id, cameraModelName: String(cam.name ?? '') }
    }
  }

  return fallbackSingleModel(supabase, ids)
}

async function fallbackSingleModel(
  supabase: SupabaseClient,
  ids: string[]
): Promise<{ cameraModelId: string; cameraModelName: string } | null> {
  const unique = [...new Set(ids)]
  if (unique.length !== 1) return null

  const { data: cam } = await supabase
    .from('camera_models')
    .select('id, name, is_active')
    .eq('id', unique[0])
    .maybeSingle()

  if (!cam?.id || cam.is_active === false) return null
  return { cameraModelId: cam.id, cameraModelName: String(cam.name ?? '') }
}
