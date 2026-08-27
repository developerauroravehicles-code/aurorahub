import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureDealerLocation, ensureSpecialistLocation } from '@/lib/inventory-v2/locations'
import { recordReceipt, recordTransfer } from '@/lib/inventory-v2/movements'
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

async function fetchBarcodeByCode(
  supabase: SupabaseClient,
  code: string
): Promise<InventoryBarcodeRow | null> {
  const normalized = normalizeBarcodeCode(code)
  const { data } = await supabase
    .from('inventory_barcodes')
    .select('*')
    .ilike('code', normalized)
    .maybeSingle()
  return (data as InventoryBarcodeRow | null) ?? null
}

export async function assignBarcodeToDealer(
  supabase: SupabaseClient,
  input: {
    code: string
    dealerId: string
    actorId: string | null
  }
): Promise<{ barcode?: InventoryBarcodeRow; error?: string }> {
  const barcode = await fetchBarcodeByCode(supabase, input.code)
  if (!barcode) return { error: 'Barcode not found' }
  if (barcode.kind !== 'unit') return { error: 'Set container barcodes cannot be assigned to dealer stock' }
  if (barcode.status !== 'generated') {
    return { error: `Barcode is ${barcode.status}; expected generated` }
  }
  if (!barcode.camera_model_id) return { error: 'Barcode has no camera model' }

  const { data: dealer } = await supabase
    .from('dealers')
    .select('name')
    .eq('id', input.dealerId)
    .maybeSingle()

  const locationId = await ensureDealerLocation(supabase, input.dealerId, dealer?.name)
  if (!locationId) return { error: 'Could not resolve dealer location' }

  const receipt = await recordReceipt(supabase, {
    toLocationId: locationId,
    cameraModelId: barcode.camera_model_id,
    quantity: 1,
    note: `Barcode ${barcode.code} assigned to dealer`,
    createdBy: input.actorId,
  })
  if (receipt.error) return { error: receipt.error }

  const { data: updated, error } = await supabase
    .from('inventory_barcodes')
    .update({
      status: 'at_dealer',
      dealer_id: input.dealerId,
      specialist_id: null,
      inventory_location_id: locationId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', barcode.id)
    .select('*')
    .single()

  if (error || !updated) return { error: error?.message ?? 'Failed to update barcode' }

  await insertBarcodeEvent(supabase, barcode.id, 'assigned_dealer', input.actorId, {
    dealer_id: input.dealerId,
  })

  return { barcode: updated as InventoryBarcodeRow }
}

export async function assignBarcodeToSpecialist(
  supabase: SupabaseClient,
  input: {
    code: string
    dealerId: string
    specialistId: string
    actorId: string | null
  }
): Promise<{ barcode?: InventoryBarcodeRow; error?: string }> {
  const barcode = await fetchBarcodeByCode(supabase, input.code)
  if (!barcode) return { error: 'Barcode not found' }
  if (barcode.kind !== 'unit') {
    return { error: 'Set container barcodes cannot be assigned to specialist field stock' }
  }
  if (barcode.status !== 'at_dealer' && barcode.status !== 'generated') {
    return { error: `Barcode is ${barcode.status}; expected at_dealer or generated` }
  }
  if (!barcode.camera_model_id) return { error: 'Barcode has no camera model' }

  const [{ data: dealer }, { data: specialist }] = await Promise.all([
    supabase.from('dealers').select('name').eq('id', input.dealerId).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', input.specialistId).maybeSingle(),
  ])

  const dealerLocationId = await ensureDealerLocation(supabase, input.dealerId, dealer?.name)
  const specialistLocationId = await ensureSpecialistLocation(
    supabase,
    input.specialistId,
    specialist?.full_name
  )
  if (!dealerLocationId || !specialistLocationId) {
    return { error: 'Could not resolve inventory locations' }
  }

  if (barcode.status === 'generated') {
    const receipt = await recordReceipt(supabase, {
      toLocationId: dealerLocationId,
      cameraModelId: barcode.camera_model_id,
      quantity: 1,
      note: `Barcode ${barcode.code} receipt before specialist assign`,
      createdBy: input.actorId,
    })
    if (receipt.error) return { error: receipt.error }
  } else if (barcode.dealer_id && barcode.dealer_id !== input.dealerId) {
    return { error: 'Barcode belongs to a different dealer' }
  }

  const transfer = await recordTransfer(supabase, {
    fromLocationId: dealerLocationId,
    toLocationId: specialistLocationId,
    cameraModelId: barcode.camera_model_id,
    quantity: 1,
    note: `Barcode ${barcode.code} assigned to specialist`,
    createdBy: input.actorId,
  })
  if (transfer.error) return { error: transfer.error }

  const { data: updated, error } = await supabase
    .from('inventory_barcodes')
    .update({
      status: 'at_specialist',
      dealer_id: input.dealerId,
      specialist_id: input.specialistId,
      inventory_location_id: specialistLocationId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', barcode.id)
    .select('*')
    .single()

  if (error || !updated) return { error: error?.message ?? 'Failed to update barcode' }

  await insertBarcodeEvent(supabase, barcode.id, 'assigned_specialist', input.actorId, {
    dealer_id: input.dealerId,
    specialist_id: input.specialistId,
  })

  return { barcode: updated as InventoryBarcodeRow }
}

export async function voidBarcode(
  supabase: SupabaseClient,
  barcodeId: string,
  actorId: string | null
): Promise<{ error?: string }> {
  const { data: barcode } = await supabase
    .from('inventory_barcodes')
    .select('status')
    .eq('id', barcodeId)
    .maybeSingle()

  if (!barcode) return { error: 'Barcode not found' }
  if (barcode.status === 'consumed') return { error: 'Consumed barcodes cannot be voided' }

  const { error } = await supabase
    .from('inventory_barcodes')
    .update({ status: 'void', updated_at: new Date().toISOString() })
    .eq('id', barcodeId)

  if (error) return { error: error.message }

  await insertBarcodeEvent(supabase, barcodeId, 'void', actorId, {})
  return {}
}
