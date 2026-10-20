import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureSpecialistLocation } from '@/lib/inventory-v2/locations'
import { recordAdjustment } from '@/lib/inventory-v2/movements'

async function resolveSpecialistIdForRelease(
  supabase: SupabaseClient,
  barcodeId: string,
  specialistIdOnRow: string | null
): Promise<string | null> {
  if (specialistIdOnRow) return specialistIdOnRow

  const { data: events } = await supabase
    .from('inventory_barcode_events')
    .select('event_type, metadata, created_at')
    .eq('barcode_id', barcodeId)
    .order('created_at', { ascending: false })
    .limit(20)

  for (const ev of events ?? []) {
    if (ev.event_type === 'assigned_specialist') {
      const meta = ev.metadata as { specialist_id?: string } | null
      if (meta?.specialist_id) return meta.specialist_id
    }
  }
  return null
}

/** Undo mistaken consume — barcode returns to specialist field stock (at_specialist). */
export async function releaseConsumedBarcode(
  supabase: SupabaseClient,
  input: {
    barcodeId: string
    actorId: string | null
    reason: string
  }
): Promise<{ error?: string }> {
  const reason = input.reason.trim()
  if (!reason) return { error: 'A short reason is required' }

  const { data: barcode } = await supabase
    .from('inventory_barcodes')
    .select('id, code, kind, status, camera_model_id, specialist_id, dealer_id, demand_id')
    .eq('id', input.barcodeId)
    .maybeSingle()

  if (!barcode) return { error: 'Barcode not found' }
  if (barcode.kind !== 'unit') return { error: 'Only unit barcodes can be released' }
  if (barcode.status !== 'consumed') return { error: 'Barcode is not consumed' }

  const specialistId = await resolveSpecialistIdForRelease(
    supabase,
    barcode.id,
    barcode.specialist_id as string | null
  )
  if (!specialistId) {
    return {
      error:
        'Cannot determine which specialist had this unit. Re-assign via specialist scan after fixing status in support.',
    }
  }

  const { data: specialist } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', specialistId)
    .maybeSingle()

  const specialistLocationId = await ensureSpecialistLocation(
    supabase,
    specialistId,
    specialist?.full_name
  )

  if (specialistLocationId && barcode.camera_model_id) {
    const adj = await recordAdjustment(supabase, {
      locationId: specialistLocationId,
      cameraModelId: barcode.camera_model_id as string,
      quantityDelta: 1,
      note: `Manual release consumed barcode ${barcode.code}: ${reason}`,
      createdBy: input.actorId,
    })
    if (adj.error) return { error: adj.error }
  }

  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('inventory_barcodes')
    .update({
      status: 'at_specialist',
      specialist_id: specialistId,
      inventory_location_id: specialistLocationId,
      demand_id: null,
      consumed_at: null,
      updated_at: now,
    })
    .eq('id', barcode.id)

  if (updateError) return { error: updateError.message }

  await supabase.from('inventory_barcode_events').insert({
    barcode_id: barcode.id,
    event_type: 'release_consumed',
    actor_id: input.actorId,
    demand_id: barcode.demand_id,
    metadata: {
      reason,
      previous_demand_id: barcode.demand_id,
      specialist_id: specialistId,
    },
  })

  return {}
}
