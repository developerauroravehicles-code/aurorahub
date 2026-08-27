import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureDealerLocation, ensureSpecialistLocation } from '@/lib/inventory-v2/locations'
import type { DemandServiceType } from '@/lib/demand-pricing'
import { normalizeBarcodeCode } from './code-generator'
import type { InventoryBarcodeRow } from './types'

async function insertBarcodeEvent(
  supabase: SupabaseClient,
  barcodeId: string,
  eventType: string,
  actorId: string | null,
  metadata: Record<string, unknown> = {},
  demandId?: string | null
) {
  await supabase.from('inventory_barcode_events').insert({
    barcode_id: barcodeId,
    event_type: eventType,
    actor_id: actorId,
    demand_id: demandId ?? null,
    metadata,
  })
}

async function recordConsumptionMovement(
  supabase: SupabaseClient,
  input: {
    cameraModelId: string
    fromLocationId: string
    demandId: string
    note: string
  }
): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from('inventory_movements_v2')
    .select('id')
    .eq('reference_demand_id', input.demandId)
    .eq('movement_type', 'consumption')
    .eq('from_location_id', input.fromLocationId)
    .maybeSingle()

  if (existing) return {}

  const { error } = await supabase.from('inventory_movements_v2').insert({
    camera_model_id: input.cameraModelId,
    movement_type: 'consumption',
    quantity: 1,
    from_location_id: input.fromLocationId,
    reference_demand_id: input.demandId,
    note: input.note,
  })

  if (error) return { error: error.message }
  return {}
}

export async function consumeBarcodeForDemand(
  userSupabase: SupabaseClient,
  adminSupabase: SupabaseClient,
  input: {
    code: string
    demandId: string
    specialistId: string
    dealerId: string
    actorId: string | null
    serviceType: DemandServiceType
  }
): Promise<{ barcode?: InventoryBarcodeRow; cameraModelId?: string; error?: string }> {
  const normalized = normalizeBarcodeCode(input.code)

  const { data: lookupRows, error: lookupError } = await userSupabase.rpc(
    'lookup_specialist_barcode_for_completion',
    { p_code: normalized }
  )

  if (lookupError) return { error: lookupError.message }

  const lookup = Array.isArray(lookupRows) ? lookupRows[0] : lookupRows
  if (!lookup?.barcode_id) {
    return { error: 'Invalid barcode or not assigned to you' }
  }

  const { data: barcode } = await adminSupabase
    .from('inventory_barcodes')
    .select('*')
    .eq('id', lookup.barcode_id)
    .single()

  if (!barcode) return { error: 'Barcode not found' }

  const cameraModelId = barcode.camera_model_id as string | null
  if (!cameraModelId) return { error: 'Barcode has no camera model' }

  if (input.serviceType === 'installation') {
    const [{ data: dealer }, { data: specialist }] = await Promise.all([
      adminSupabase.from('dealers').select('name').eq('id', input.dealerId).maybeSingle(),
      adminSupabase.from('profiles').select('full_name').eq('id', input.specialistId).maybeSingle(),
    ])

    const dealerLocationId = await ensureDealerLocation(adminSupabase, input.dealerId, dealer?.name)
    const specialistLocationId = await ensureSpecialistLocation(
      adminSupabase,
      input.specialistId,
      specialist?.full_name
    )

    if (dealerLocationId) {
      const dealerConsume = await recordConsumptionMovement(adminSupabase, {
        cameraModelId,
        fromLocationId: dealerLocationId,
        demandId: input.demandId,
        note: `Barcode ${barcode.code} consumption (dealer)`,
      })
      if (dealerConsume.error) return { error: dealerConsume.error }
    }

    if (specialistLocationId) {
      const specialistConsume = await recordConsumptionMovement(adminSupabase, {
        cameraModelId,
        fromLocationId: specialistLocationId,
        demandId: input.demandId,
        note: `Barcode ${barcode.code} consumption (specialist)`,
      })
      if (specialistConsume.error) return { error: specialistConsume.error }
    }
  }

  const now = new Date().toISOString()
  const { data: updated, error } = await adminSupabase
    .from('inventory_barcodes')
    .update({
      status: 'consumed',
      demand_id: input.demandId,
      consumed_at: now,
      updated_at: now,
    })
    .eq('id', barcode.id)
    .select('*')
    .single()

  if (error || !updated) return { error: error?.message ?? 'Failed to mark barcode consumed' }

  await insertBarcodeEvent(
    adminSupabase,
    barcode.id,
    'consumed',
    input.actorId,
    { demand_id: input.demandId, service_type: input.serviceType },
    input.demandId
  )

  return { barcode: updated as InventoryBarcodeRow, cameraModelId }
}

export async function validateSpecialistBarcode(
  supabase: SupabaseClient,
  code: string
): Promise<{ valid: boolean; cameraModelName?: string; error?: string }> {
  const { data, error } = await supabase.rpc('lookup_specialist_barcode_for_completion', {
    p_code: normalizeBarcodeCode(code),
  })
  if (error) return { valid: false, error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.barcode_id) return { valid: false, error: 'Invalid barcode or not assigned to you' }
  return { valid: true, cameraModelName: row.camera_model_name ?? undefined }
}
