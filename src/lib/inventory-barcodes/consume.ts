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
    .eq('camera_model_id', input.cameraModelId)
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

export async function lookupUnitBarcodeAtSpecialist(
  adminSupabase: SupabaseClient,
  code: string,
  specialistId: string
): Promise<
  | { barcodeId: string; cameraModelId: string; cameraModelName: string | null }
  | { error: string }
> {
  const normalized = normalizeBarcodeCode(code)
  if (!normalized) return { error: 'Enter a barcode' }
  if (!specialistId) return { error: 'Select a specialist first' }

  const { data: rows, error } = await adminSupabase
    .from('inventory_barcodes')
    .select('id, code, camera_model_id, status, specialist_id, kind, camera_models(name)')
    .eq('kind', 'unit')
    .eq('status', 'at_specialist')
    .eq('specialist_id', specialistId)

  if (error) return { error: error.message }

  const match = (rows ?? []).find(
    (b) => normalizeBarcodeCode(String(b.code ?? '')) === normalized
  )
  if (!match) {
    return { error: 'Invalid barcode or not on the selected specialist field stock' }
  }
  if (!match.camera_model_id) return { error: 'Barcode has no camera model' }

  const modelJoin = match.camera_models as { name?: string } | { name?: string }[] | null
  const modelName = Array.isArray(modelJoin) ? modelJoin[0]?.name : modelJoin?.name

  return {
    barcodeId: match.id,
    cameraModelId: match.camera_model_id as string,
    cameraModelName: modelName ?? null,
  }
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
    /** Aurora Manager completing external demand — resolve barcode on assigned specialist stock. */
    adminResolveForSpecialist?: boolean
  }
): Promise<{ barcode?: InventoryBarcodeRow; cameraModelId?: string; error?: string }> {
  const normalized = normalizeBarcodeCode(input.code)

  let barcodeId: string | null = null

  if (input.adminResolveForSpecialist) {
    const resolved = await lookupUnitBarcodeAtSpecialist(
      adminSupabase,
      normalized,
      input.specialistId
    )
    if ('error' in resolved) return { error: resolved.error }
    barcodeId = resolved.barcodeId
  } else {
    const { data: lookupRows, error: lookupError } = await userSupabase.rpc(
      'lookup_specialist_barcode_for_completion',
      { p_code: normalized }
    )

    if (lookupError) return { error: lookupError.message }

    const lookup = Array.isArray(lookupRows) ? lookupRows[0] : lookupRows
    if (!lookup?.barcode_id) {
      return { error: 'Invalid barcode or not assigned to you' }
    }
    barcodeId = lookup.barcode_id
  }

  const { data: barcode } = await adminSupabase
    .from('inventory_barcodes')
    .select('*')
    .eq('id', barcodeId)
    .single()

  if (!barcode) return { error: 'Barcode not found' }

  const cameraModelId = barcode.camera_model_id as string | null
  if (!cameraModelId) return { error: 'Barcode has no camera model' }

  if (input.serviceType === 'installation') {
    const { data: assignEvent } = await adminSupabase
      .from('inventory_barcode_events')
      .select('metadata')
      .eq('barcode_id', barcode.id)
      .eq('event_type', 'assigned_specialist')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const assignMeta = (assignEvent?.metadata ?? {}) as {
      direct_from_generated?: boolean
      previous_dealer_id?: string | null
    }
    const directToSpecialist = assignMeta.direct_from_generated === true

    const [{ data: dealer }, { data: specialist }] = await Promise.all([
      adminSupabase.from('dealers').select('name').eq('id', input.dealerId).maybeSingle(),
      adminSupabase.from('profiles').select('full_name').eq('id', input.specialistId).maybeSingle(),
    ])

    const dealerLocationId = directToSpecialist
      ? null
      : await ensureDealerLocation(adminSupabase, input.dealerId, dealer?.name)
    const specialistLocationId = await ensureSpecialistLocation(
      adminSupabase,
      input.specialistId,
      specialist?.full_name
    )

    if (!directToSpecialist && dealerLocationId) {
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

/** Consume multiple unit barcodes on one completed installation (e.g. set: Nova + battery). */
export async function consumeBarcodesForDemand(
  userSupabase: SupabaseClient,
  adminSupabase: SupabaseClient,
  input: {
    codes: string[]
    demandId: string
    specialistId: string
    dealerId: string
    actorId: string | null
    serviceType: DemandServiceType
    adminResolveForSpecialist?: boolean
  }
): Promise<{ cameraModelIds: string[]; error?: string }> {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const raw of input.codes) {
    const code = normalizeBarcodeCode(raw)
    if (!code) continue
    const key = code.toLowerCase()
    if (seen.has(key)) {
      return { cameraModelIds: [], error: `Duplicate barcode in list: ${code}` }
    }
    seen.add(key)
    unique.push(code)
  }

  if (unique.length === 0) {
    return { cameraModelIds: [], error: 'At least one product barcode is required' }
  }

  const cameraModelIds: string[] = []
  for (const code of unique) {
    const result = await consumeBarcodeForDemand(userSupabase, adminSupabase, {
      code,
      demandId: input.demandId,
      specialistId: input.specialistId,
      dealerId: input.dealerId,
      actorId: input.actorId,
      serviceType: input.serviceType,
      adminResolveForSpecialist: input.adminResolveForSpecialist,
    })
    if (result.error) {
      return {
        cameraModelIds,
        error: `${code}: ${result.error}`,
      }
    }
    if (result.cameraModelId) cameraModelIds.push(result.cameraModelId)
  }

  return { cameraModelIds }
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
