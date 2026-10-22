import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureSpecialistLocation } from '@/lib/inventory-v2/locations'
import type { DemandServiceType } from '@/lib/demand-pricing'
import { fetchBarcodeByCode } from './assign'
import { normalizeBarcodeCode } from './code-generator'
import type { InventoryBarcodeRow } from './types'
import { recordConsumptionMovement } from './consumption-movement'
import { rollbackDemandBarcodeConsumption } from './rollback-demand-consumption'
import { resolveBarcodeSpecialistId } from './release-consumed'

export function isOrphanedConsumedBarcode(barcode: Pick<InventoryBarcodeRow, 'status' | 'demand_id'>): boolean {
  return barcode.status === 'consumed' && (barcode.demand_id == null || barcode.demand_id === '')
}

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

async function explainBarcodeSpecialistMismatch(
  adminSupabase: SupabaseClient,
  barcode: InventoryBarcodeRow,
  specialistId: string
): Promise<string> {
  if (barcode.kind === 'set') {
    return 'Legacy set container label — scan each unit product label for this installation (Nova, battery, etc.).'
  }
  if (barcode.kind !== 'unit') {
    return 'Not a unit product barcode.'
  }
  if (barcode.status === 'void') {
    return 'This label was voided. Register or generate a replacement unit barcode and assign it to the specialist.'
  }
  if (barcode.status === 'consumed') {
    if (isOrphanedConsumedBarcode(barcode)) {
      return 'This label is marked consumed but not linked to any demand — select the specialist who had this unit, or use Inventory → Release consumed to return it to field stock.'
    }
    return 'This label is already consumed on another completed job.'
  }
  if (barcode.status === 'generated') {
    return 'Label is in warehouse (generated) — assign it to the specialist in Inventory before scanning here.'
  }
  if (barcode.status === 'at_dealer') {
    return 'Label is on dealer stock — assign it to the specialist field stock in Inventory first.'
  }
  if (barcode.status !== 'at_specialist') {
    return `Label status is "${barcode.status}" — expected specialist field stock.`
  }
  if (barcode.specialist_id !== specialistId) {
    const otherId = barcode.specialist_id as string | null
    if (otherId) {
      const { data: other } = await adminSupabase
        .from('profiles')
        .select('full_name')
        .eq('id', otherId)
        .maybeSingle()
      const name = other?.full_name?.trim() || 'another specialist'
      return `Label is on ${name}'s field stock — select that specialist or re-assign the label.`
    }
    return 'Label is not linked to the selected specialist.'
  }
  return 'Invalid barcode or not on the selected specialist field stock'
}

async function specialistMatchesBarcode(
  adminSupabase: SupabaseClient,
  barcode: InventoryBarcodeRow,
  specialistId: string
): Promise<boolean> {
  if (barcode.specialist_id === specialistId) return true
  const resolved = await resolveBarcodeSpecialistId(
    adminSupabase,
    barcode.id,
    barcode.specialist_id as string | null
  )
  return resolved === specialistId
}

export async function lookupUnitBarcodeAtSpecialist(
  adminSupabase: SupabaseClient,
  code: string,
  specialistId: string,
  options?: { allowOrphanedConsumed?: boolean }
): Promise<
  | { barcodeId: string; cameraModelId: string; cameraModelName: string | null }
  | { error: string }
> {
  const normalized = normalizeBarcodeCode(code)
  if (!normalized) return { error: 'Enter a barcode' }
  if (!specialistId) return { error: 'Select a specialist first' }

  const barcode = await fetchBarcodeByCode(adminSupabase, normalized)
  if (!barcode) {
    return { error: 'Barcode not found in registry — check the code or use Register printed label.' }
  }

  const orphanedConsumed =
    options?.allowOrphanedConsumed && isOrphanedConsumedBarcode(barcode)

  if (barcode.kind !== 'unit') {
    const detail = await explainBarcodeSpecialistMismatch(adminSupabase, barcode, specialistId)
    return { error: detail }
  }

  if (orphanedConsumed) {
    const matches = await specialistMatchesBarcode(adminSupabase, barcode, specialistId)
    if (!matches) {
      const ownerId = await resolveBarcodeSpecialistId(
        adminSupabase,
        barcode.id,
        barcode.specialist_id as string | null
      )
      if (ownerId && ownerId !== specialistId) {
        const { data: other } = await adminSupabase
          .from('profiles')
          .select('full_name')
          .eq('id', ownerId)
          .maybeSingle()
        const name = other?.full_name?.trim() || 'another specialist'
        return {
          error: `Label is consumed (no demand linked) and belongs to ${name} — select that specialist or use Inventory → Release consumed.`,
        }
      }
      return { error: 'Label is not linked to the selected specialist.' }
    }
  } else if (barcode.status !== 'at_specialist' || barcode.specialist_id !== specialistId) {
    const detail = await explainBarcodeSpecialistMismatch(adminSupabase, barcode, specialistId)
    return { error: detail }
  }

  if (!barcode.camera_model_id) return { error: 'Barcode has no camera model' }

  const { data: cam } = await adminSupabase
    .from('camera_models')
    .select('name')
    .eq('id', barcode.camera_model_id)
    .maybeSingle()

  return {
    barcodeId: barcode.id,
    cameraModelId: barcode.camera_model_id as string,
    cameraModelName: cam?.name ?? null,
  }
}

/** Dry-run: all unit codes must be on the selected specialist before creating a demand. */
export async function validateUnitBarcodesAtSpecialist(
  adminSupabase: SupabaseClient,
  codes: string[],
  specialistId: string,
  options?: { allowOrphanedConsumed?: boolean }
): Promise<{ ok: true } | { error: string }> {
  if (!specialistId.trim()) {
    return { error: 'Select the specialist whose field stock these barcodes belong to.' }
  }
  const seen = new Set<string>()
  for (const raw of codes) {
    const code = normalizeBarcodeCode(raw)
    if (!code) continue
    const key = code.toLowerCase()
    if (seen.has(key)) return { error: `Duplicate barcode in list: ${code}` }
    seen.add(key)
    const resolved = await lookupUnitBarcodeAtSpecialist(
      adminSupabase,
      code,
      specialistId,
      options
    )
    if ('error' in resolved) return { error: `${code}: ${resolved.error}` }
  }
  return { ok: true }
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
      input.specialistId,
      { allowOrphanedConsumed: true }
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

  if (isOrphanedConsumedBarcode(barcode as InventoryBarcodeRow)) {
    const now = new Date().toISOString()
    const { data: updated, error: relinkError } = await adminSupabase
      .from('inventory_barcodes')
      .update({
        demand_id: input.demandId,
        consumed_at: (barcode.consumed_at as string | null) ?? now,
        updated_at: now,
      })
      .eq('id', barcode.id)
      .select('*')
      .single()

    if (relinkError || !updated) {
      return { error: relinkError?.message ?? 'Failed to link barcode to demand' }
    }

    await insertBarcodeEvent(
      adminSupabase,
      barcode.id,
      'consumed',
      input.actorId,
      {
        demand_id: input.demandId,
        service_type: input.serviceType,
        relink_orphaned_consumed: true,
      },
      input.demandId
    )

    return { barcode: updated as InventoryBarcodeRow, cameraModelId }
  }

  const { data: specialist } = await adminSupabase
    .from('profiles')
    .select('full_name')
    .eq('id', input.specialistId)
    .maybeSingle()

  const specialistLocationId = await ensureSpecialistLocation(
    adminSupabase,
    input.specialistId,
    specialist?.full_name
  )

  // Scanned unit leaves specialist field stock — ledger consumption for all service types (install/transfer/removal).
  if (specialistLocationId) {
    const specialistConsume = await recordConsumptionMovement(adminSupabase, {
      cameraModelId,
      fromLocationId: specialistLocationId,
      demandId: input.demandId,
      note: `Barcode ${barcode.code} consumption (specialist, ${input.serviceType})`,
    })
    if (specialistConsume.error) return { error: specialistConsume.error }
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
      const rollback = await rollbackDemandBarcodeConsumption(adminSupabase, {
        demandId: input.demandId,
        actorId: input.actorId,
        reason: `Rollback after failed consume of ${code}`,
      })
      const rollbackNote = rollback.error ? ` Rollback warning: ${rollback.error}` : ''
      return {
        cameraModelIds: [],
        error: `${code}: ${result.error}${rollbackNote}`,
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
