import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureSpecialistLocation } from '@/lib/inventory-v2/locations'
import { recordAdjustment } from '@/lib/inventory-v2/movements'
import { normalizeBarcodeCode } from './code-generator'
import { ensureDealerLocation } from '@/lib/inventory-v2/locations'

export const DEMAND_BARCODE_CHANGE_REASONS = [
  { id: 'return', label: 'Return / undo wrong scan' },
  { id: 'warranty_replacement', label: 'Warranty replacement' },
  { id: 'defective_unit', label: 'Defective unit swap' },
  { id: 'data_correction', label: 'Data correction' },
  { id: 'other', label: 'Other (explain in notes)' },
] as const

export type DemandBarcodeChangeReason = (typeof DEMAND_BARCODE_CHANGE_REASONS)[number]['id']

export async function changeDemandInstalledBarcode(
  adminSupabase: SupabaseClient,
  input: {
    demandId: string
    newBarcodeCode: string
    reason: DemandBarcodeChangeReason
    notes: string
    actorId: string
    specialistId: string
    dealerId: string
    serviceType: 'installation' | 'transfer' | 'removal'
  }
): Promise<{ error?: string; newCode?: string }> {
  const notes = input.notes.trim()
  if (!notes) return { error: 'A written reason is required' }
  if (!DEMAND_BARCODE_CHANGE_REASONS.some((r) => r.id === input.reason)) {
    return { error: 'Invalid reason' }
  }

  const { data: demand } = await adminSupabase
    .from('demands')
    .select('id, status, dealer_id, assigned_specialist_id')
    .eq('id', input.demandId)
    .maybeSingle()

  if (!demand) return { error: 'Demand not found' }
  if (demand.status !== 'completed') {
    return { error: 'Barcode changes are only allowed on completed installations' }
  }

  const { data: oldBarcodes } = await adminSupabase
    .from('inventory_barcodes')
    .select('id, code, camera_model_id, specialist_id, status')
    .eq('demand_id', input.demandId)
    .eq('status', 'consumed')

  const oldBarcode = oldBarcodes?.[0]
  if (!oldBarcode) return { error: 'No consumed barcode is linked to this demand' }

  const newCode = normalizeBarcodeCode(input.newBarcodeCode)
  const { data: newBarcode } = await adminSupabase
    .from('inventory_barcodes')
    .select('id, code, status, camera_model_id, specialist_id')
    .ilike('code', newCode)
    .maybeSingle()

  if (!newBarcode) return { error: 'New barcode not found' }
  if (newBarcode.status !== 'at_specialist') {
    return { error: 'New barcode must be on specialist field stock (at_specialist)' }
  }
  if (newBarcode.id === oldBarcode.id) return { error: 'New barcode is the same as the current one' }

  const specialistId = (demand.assigned_specialist_id as string | null) ?? input.specialistId
  const { data: specialist } = await adminSupabase
    .from('profiles')
    .select('full_name')
    .eq('id', specialistId)
    .maybeSingle()

  const specialistLocationId = await ensureSpecialistLocation(
    adminSupabase,
    specialistId,
    specialist?.full_name
  )

  const now = new Date().toISOString()

  const { error: releaseError } = await adminSupabase
    .from('inventory_barcodes')
    .update({
      status: 'at_specialist',
      demand_id: null,
      consumed_at: null,
      specialist_id: specialistId,
      updated_at: now,
    })
    .eq('id', oldBarcode.id)

  if (releaseError) return { error: releaseError.message }

  if (specialistLocationId && oldBarcode.camera_model_id) {
    const adj = await recordAdjustment(adminSupabase, {
      locationId: specialistLocationId,
      cameraModelId: oldBarcode.camera_model_id as string,
      quantityDelta: 1,
      note: `Released from demand ${input.demandId} (${input.reason})`,
      createdBy: input.actorId,
    })
    if (adj.error) return { error: adj.error }
  }

  await adminSupabase.from('inventory_barcode_events').insert({
    barcode_id: oldBarcode.id,
    event_type: 'released_from_demand',
    actor_id: input.actorId,
    demand_id: input.demandId,
    metadata: {
      reason: input.reason,
      notes,
      replaced_by_code: newBarcode.code,
    },
  })

  const nowConsume = new Date().toISOString()
  const { error: consumeUpdateError } = await adminSupabase
    .from('inventory_barcodes')
    .update({
      status: 'consumed',
      demand_id: input.demandId,
      consumed_at: nowConsume,
      updated_at: nowConsume,
    })
    .eq('id', newBarcode.id)

  if (consumeUpdateError) return { error: consumeUpdateError.message }

  if (input.serviceType === 'installation' && newBarcode.camera_model_id && specialistLocationId) {
    const { data: existingMove } = await adminSupabase
      .from('inventory_movements_v2')
      .select('id')
      .eq('reference_demand_id', input.demandId)
      .eq('movement_type', 'consumption')
      .eq('from_location_id', specialistLocationId)
      .maybeSingle()

    if (!existingMove) {
      await adminSupabase.from('inventory_movements_v2').insert({
        camera_model_id: newBarcode.camera_model_id,
        movement_type: 'consumption',
        quantity: 1,
        from_location_id: specialistLocationId,
        reference_demand_id: input.demandId,
        note: `Barcode ${newBarcode.code} consumption (specialist) after reassignment`,
      })
    }

    const dealerLocationId = await ensureDealerLocation(
      adminSupabase,
      input.dealerId,
      null
    )
    if (dealerLocationId) {
      const { data: dealerMove } = await adminSupabase
        .from('inventory_movements_v2')
        .select('id')
        .eq('reference_demand_id', input.demandId)
        .eq('movement_type', 'consumption')
        .eq('from_location_id', dealerLocationId)
        .maybeSingle()
      if (!dealerMove) {
        await adminSupabase.from('inventory_movements_v2').insert({
          camera_model_id: newBarcode.camera_model_id,
          movement_type: 'consumption',
          quantity: 1,
          from_location_id: dealerLocationId,
          reference_demand_id: input.demandId,
          note: `Barcode ${newBarcode.code} consumption (dealer) after reassignment`,
        })
      }
    }
  }

  await adminSupabase.from('inventory_barcode_events').insert({
    barcode_id: newBarcode.id,
    event_type: 'consumed',
    actor_id: input.actorId,
    demand_id: input.demandId,
    metadata: { service_type: input.serviceType, reassignment: true },
  })

  await adminSupabase.from('inventory_barcode_events').insert({
    barcode_id: newBarcode.id,
    event_type: 'reassigned_to_demand',
    actor_id: input.actorId,
    demand_id: input.demandId,
    metadata: {
      reason: input.reason,
      notes,
      previous_barcode_code: oldBarcode.code,
    },
  })

  await adminSupabase.from('demand_logs').insert({
    demand_id: input.demandId,
    actor_id: input.actorId,
    previous_status: 'completed',
    new_status: 'completed',
    notes: `Barcode changed: ${oldBarcode.code} → ${newBarcode.code} (${input.reason}). ${notes}`,
  })

  return { newCode: newBarcode.code }
}
