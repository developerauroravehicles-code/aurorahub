'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addManualInventoryMovement(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can manage inventory' }
  }

  const dealerId = (formData.get('dealer_id') as string)?.trim()
  const cameraModelId = (formData.get('camera_model_id') as string)?.trim()
  const movementType = (formData.get('movement_type') as string)?.trim() as
    | 'receipt'
    | 'adjustment'
    | 'return_to_hq'
  const note = ((formData.get('note') as string) ?? '').trim() || null

  const quantityRaw = String(formData.get('quantity') ?? '').trim()
  const q = parseInt(quantityRaw, 10)

  if (!dealerId || !cameraModelId) return { error: 'Dealer and camera model are required' }
  if (!['receipt', 'adjustment', 'return_to_hq'].includes(movementType)) {
    return { error: 'Invalid movement type' }
  }
  if (!Number.isFinite(q)) return { error: 'Quantity must be an integer' }

  let quantityDelta: number
  if (movementType === 'receipt') {
    if (q < 1) return { error: 'Receipt quantity must be at least 1' }
    quantityDelta = q
  } else if (movementType === 'return_to_hq') {
    if (q < 1) return { error: 'Quantity must be at least 1' }
    quantityDelta = -q
  } else {
    if (q === 0) return { error: 'Adjustment cannot be zero' }
    quantityDelta = q
  }

  const { error: insertError } = await supabase.from('inventory_movements').insert({
    dealer_id: dealerId,
    camera_model_id: cameraModelId,
    quantity_delta: quantityDelta,
    movement_type: movementType,
    note,
    created_by: user.id,
  })

  if (insertError) return { error: insertError.message }
  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
}

export async function upsertInventoryThreshold(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can manage inventory' }
  }

  const dealerId = (formData.get('dealer_id') as string)?.trim()
  const cameraModelId = (formData.get('camera_model_id') as string)?.trim()
  const minQty = parseInt(String(formData.get('min_qty') ?? '0'), 10)

  if (!dealerId || !cameraModelId) return { error: 'Dealer and camera model are required' }
  if (!Number.isFinite(minQty) || minQty < 0) return { error: 'Minimum quantity must be 0 or greater' }

  const { error: upError } = await supabase.from('dealer_inventory_thresholds').upsert(
    {
      dealer_id: dealerId,
      camera_model_id: cameraModelId,
      min_qty: minQty,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dealer_id,camera_model_id' }
  )

  if (upError) return { error: upError.message }
  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
}

export async function upsertDealerCameraPricing(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can manage inventory pricing' }
  }

  const dealerId = (formData.get('dealer_id') as string)?.trim()
  const cameraModelId = (formData.get('camera_model_id') as string)?.trim()
  const priceRaw = String(formData.get('price_cad') ?? '').trim()
  const price = parseFloat(priceRaw)

  if (!dealerId || !cameraModelId) return { error: 'Dealer and camera model are required' }
  if (!Number.isFinite(price) || price < 0) return { error: 'Price must be 0 or greater' }

  const { error: upError } = await supabase.from('dealer_camera_pricing').upsert(
    {
      dealer_id: dealerId,
      camera_model_id: cameraModelId,
      price_cad: price,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dealer_id,camera_model_id' }
  )

  if (upError) return { error: upError.message }
  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
}

export async function resetInventoryStockData(): Promise<{
  error?: string
  success?: string
  movements_deleted?: number
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can reset inventory stock' }
  }

  const { data, error } = await supabase.rpc('reset_inventory_stock_data')
  if (error) return { error: error.message }

  const row = data as { movements_deleted?: number; success?: boolean } | null
  const n = typeof row?.movements_deleted === 'number' ? row.movements_deleted : undefined
  const suffix = n != null ? ` (${n} movement row(s) removed.)` : ''
  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: `Inventory ledger cleared and HQ catalog quantities set to 0.${suffix}` }
}
