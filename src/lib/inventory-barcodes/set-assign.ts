import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeBarcodeCode } from './code-generator'
import { assignBarcodeToSpecialist } from './assign'
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

export type SetAssignProgress = {
  setId: string
  setCode: string
  assignedUnitCount: number
  expectedUnitCount: number
  complete: boolean
}

async function expectedUnitCountForSet(
  supabase: SupabaseClient,
  setBarcode: InventoryBarcodeRow
): Promise<number> {
  if (!setBarcode.set_template_id) return 0
  const { data: items } = await supabase
    .from('inventory_barcode_set_template_items')
    .select('quantity')
    .eq('template_id', setBarcode.set_template_id)
  return (items ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0)
}

async function countAssignedUnitsInSet(
  supabase: SupabaseClient,
  setId: string,
  specialistId: string
): Promise<number> {
  const { count } = await supabase
    .from('inventory_barcodes')
    .select('id', { count: 'exact', head: true })
    .eq('parent_barcode_id', setId)
    .eq('kind', 'unit')
    .eq('specialist_id', specialistId)
    .eq('status', 'at_specialist')
  return count ?? 0
}

/** Scan set container — specialist owns the kit; unit scans link under this set. */
export async function activateSetForSpecialistAssignment(
  supabase: SupabaseClient,
  input: { code: string; specialistId: string; actorId: string | null }
): Promise<{ progress?: SetAssignProgress; error?: string }> {
  const setBarcode = await fetchBarcodeByCode(supabase, input.code)
  if (!setBarcode) return { error: 'Barcode not found' }
  if (setBarcode.kind !== 'set') return { error: 'Scan a set barcode first, then scan each unit label' }
  if (setBarcode.status !== 'generated' && setBarcode.status !== 'at_specialist') {
    return { error: `Set barcode is ${setBarcode.status}; expected generated or in-progress assignment` }
  }

  const expected = await expectedUnitCountForSet(supabase, setBarcode)
  if (expected < 1) return { error: 'Set template has no products defined' }

  const { error } = await supabase
    .from('inventory_barcodes')
    .update({
      status: 'at_specialist',
      specialist_id: input.specialistId,
      dealer_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', setBarcode.id)

  if (error) return { error: error.message }

  await insertBarcodeEvent(supabase, setBarcode.id, 'assigned_specialist', input.actorId, {
    specialist_id: input.specialistId,
    set_container: true,
  })

  const assignedUnitCount = await countAssignedUnitsInSet(
    supabase,
    setBarcode.id,
    input.specialistId
  )

  return {
    progress: {
      setId: setBarcode.id,
      setCode: setBarcode.code,
      assignedUnitCount,
      expectedUnitCount: expected,
      complete: assignedUnitCount >= expected,
    },
  }
}

/** Link a loose unit to the active set (when units were not pre-generated) and assign to specialist. */
async function linkLooseUnitToSet(
  supabase: SupabaseClient,
  unit: InventoryBarcodeRow,
  setBarcode: InventoryBarcodeRow
): Promise<{ error?: string }> {
  if (!setBarcode.set_template_id) return { error: 'Set has no template' }
  if (!unit.camera_model_id) return { error: 'Unit has no camera model' }

  const { data: items } = await supabase
    .from('inventory_barcode_set_template_items')
    .select('camera_model_id, quantity')
    .eq('template_id', setBarcode.set_template_id)

  const allowedQty =
    items?.find((i) => i.camera_model_id === unit.camera_model_id)?.quantity ?? 0
  if (allowedQty < 1) {
    return { error: 'This unit model is not part of the scanned set template' }
  }

  const { count: alreadyLinked } = await supabase
    .from('inventory_barcodes')
    .select('id', { count: 'exact', head: true })
    .eq('parent_barcode_id', setBarcode.id)
    .eq('camera_model_id', unit.camera_model_id)

  if ((alreadyLinked ?? 0) >= allowedQty) {
    return { error: 'This set already has the maximum units for this model' }
  }

  const { error } = await supabase
    .from('inventory_barcodes')
    .update({
      parent_barcode_id: setBarcode.id,
      set_template_id: setBarcode.set_template_id,
      batch_id: setBarcode.batch_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', unit.id)

  if (error) return { error: error.message }
  return {}
}

export async function assignUnitUnderSetToSpecialist(
  supabase: SupabaseClient,
  input: {
    unitCode: string
    setId: string
    specialistId: string
    actorId: string | null
    allowLinkLooseUnit?: boolean
  }
): Promise<{ progress?: SetAssignProgress; barcode?: InventoryBarcodeRow; error?: string }> {
  const { data: setBarcode } = await supabase
    .from('inventory_barcodes')
    .select('*')
    .eq('id', input.setId)
    .maybeSingle()

  if (!setBarcode || setBarcode.kind !== 'set') {
    return { error: 'Active set session expired — scan the set barcode again' }
  }
  if (setBarcode.specialist_id !== input.specialistId) {
    return { error: 'This set is assigned to a different specialist' }
  }

  let unit = await fetchBarcodeByCode(supabase, input.unitCode)
  if (!unit) return { error: 'Unit barcode not found' }
  if (unit.kind !== 'unit') return { error: 'Scan a unit barcode (not the set label again)' }

  if (unit.parent_barcode_id && unit.parent_barcode_id !== input.setId) {
    return { error: 'This unit belongs to a different set' }
  }

  if (!unit.parent_barcode_id && input.allowLinkLooseUnit) {
    const link = await linkLooseUnitToSet(supabase, unit, setBarcode as InventoryBarcodeRow)
    if (link.error) return { error: link.error }
    unit = (await fetchBarcodeByCode(supabase, input.unitCode))!
  } else if (!unit.parent_barcode_id) {
    return { error: 'Unit is not linked to this set — scan the set barcode first' }
  }

  const assign = await assignBarcodeToSpecialist(supabase, {
    code: unit.code,
    specialistId: input.specialistId,
    actorId: input.actorId,
  })
  if (assign.error) return { error: assign.error }

  const expected = await expectedUnitCountForSet(supabase, setBarcode as InventoryBarcodeRow)
  const assignedUnitCount = await countAssignedUnitsInSet(
    supabase,
    input.setId,
    input.specialistId
  )

  return {
    barcode: assign.barcode,
    progress: {
      setId: setBarcode.id,
      setCode: setBarcode.code,
      assignedUnitCount,
      expectedUnitCount: expected,
      complete: assignedUnitCount >= expected,
    },
  }
}
