import type { SupabaseClient } from '@supabase/supabase-js'
import { getBalanceAtLocation } from './balances'
import type { InventoryMovementType } from './types'

type MovementInsert = {
  camera_model_id: string
  movement_type: InventoryMovementType
  quantity: number
  from_location_id?: string | null
  to_location_id?: string | null
  reference_demand_id?: string | null
  note?: string | null
  created_by?: string | null
}

async function insertMovement(
  supabase: SupabaseClient,
  row: MovementInsert
): Promise<{ error?: string }> {
  if (row.quantity < 1) return { error: 'Quantity must be at least 1' }
  const { error } = await supabase.from('inventory_movements_v2').insert(row)
  if (error) return { error: error.message }
  return {}
}

export async function recordReceipt(
  supabase: SupabaseClient,
  input: {
    toLocationId: string
    cameraModelId: string
    quantity: number
    note?: string | null
    createdBy?: string | null
  }
): Promise<{ error?: string }> {
  return insertMovement(supabase, {
    camera_model_id: input.cameraModelId,
    movement_type: 'receipt',
    quantity: input.quantity,
    to_location_id: input.toLocationId,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
  })
}

export async function recordAllocation(
  supabase: SupabaseClient,
  input: {
    fromLocationId: string
    toLocationId: string
    cameraModelId: string
    quantity: number
    note?: string | null
    createdBy?: string | null
  }
): Promise<{ error?: string }> {
  const onHand = await getBalanceAtLocation(supabase, input.fromLocationId, input.cameraModelId)
  if (onHand < input.quantity) {
    return { error: `Insufficient stock at source (on hand ${onHand}, requested ${input.quantity}).` }
  }
  return insertMovement(supabase, {
    camera_model_id: input.cameraModelId,
    movement_type: 'allocation',
    quantity: input.quantity,
    from_location_id: input.fromLocationId,
    to_location_id: input.toLocationId,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
  })
}

export async function recordTransfer(
  supabase: SupabaseClient,
  input: {
    fromLocationId: string
    toLocationId: string
    cameraModelId: string
    quantity: number
    note?: string | null
    createdBy?: string | null
  }
): Promise<{ error?: string }> {
  const onHand = await getBalanceAtLocation(supabase, input.fromLocationId, input.cameraModelId)
  if (onHand < input.quantity) {
    return { error: `Insufficient stock at source (on hand ${onHand}, requested ${input.quantity}).` }
  }
  return insertMovement(supabase, {
    camera_model_id: input.cameraModelId,
    movement_type: 'transfer',
    quantity: input.quantity,
    from_location_id: input.fromLocationId,
    to_location_id: input.toLocationId,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
  })
}

export async function recordAdjustment(
  supabase: SupabaseClient,
  input: {
    locationId: string
    cameraModelId: string
    quantityDelta: number
    note?: string | null
    createdBy?: string | null
  }
): Promise<{ error?: string }> {
  const absQty = Math.abs(input.quantityDelta)
  if (absQty < 1) return { error: 'Adjustment quantity cannot be zero' }

  if (input.quantityDelta > 0) {
    return insertMovement(supabase, {
      camera_model_id: input.cameraModelId,
      movement_type: 'adjustment',
      quantity: absQty,
      to_location_id: input.locationId,
      note: input.note ?? null,
      created_by: input.createdBy ?? null,
    })
  }

  const onHand = await getBalanceAtLocation(supabase, input.locationId, input.cameraModelId)
  if (onHand < absQty) {
    return { error: `Cannot reduce below zero (on hand ${onHand}).` }
  }
  return insertMovement(supabase, {
    camera_model_id: input.cameraModelId,
    movement_type: 'adjustment',
    quantity: absQty,
    from_location_id: input.locationId,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
  })
}

export async function recordReturnToUpstream(
  supabase: SupabaseClient,
  input: {
    fromLocationId: string
    toLocationId: string
    cameraModelId: string
    quantity: number
    note?: string | null
    createdBy?: string | null
  }
): Promise<{ error?: string }> {
  const onHand = await getBalanceAtLocation(supabase, input.fromLocationId, input.cameraModelId)
  if (onHand < input.quantity) {
    return { error: `Insufficient stock to return (on hand ${onHand}).` }
  }
  return insertMovement(supabase, {
    camera_model_id: input.cameraModelId,
    movement_type: 'return',
    quantity: input.quantity,
    from_location_id: input.fromLocationId,
    to_location_id: input.toLocationId,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
  })
}
