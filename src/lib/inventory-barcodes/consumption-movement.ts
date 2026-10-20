import type { SupabaseClient } from '@supabase/supabase-js'

export async function recordConsumptionMovement(
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
    .select('id, quantity')
    .eq('reference_demand_id', input.demandId)
    .eq('movement_type', 'consumption')
    .eq('from_location_id', input.fromLocationId)
    .eq('camera_model_id', input.cameraModelId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('inventory_movements_v2')
      .update({ quantity: (existing.quantity ?? 1) + 1, note: input.note })
      .eq('id', existing.id)
    if (error) return { error: error.message }
    return {}
  }

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
