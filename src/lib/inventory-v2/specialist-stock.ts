import type { SupabaseClient } from '@supabase/supabase-js'

export type FieldCameraStockRow = {
  camera_model_id: string
  model_name: string
  quantity: number
}

export type SpecialistStockSummaryRow = {
  specialist_id: string
  specialist_name: string
  location_id: string
  dealer_names: string[]
  balances: { camera_model_id: string; model_name: string; quantity: number }[]
  total_units: number
}

export async function fetchMyFieldCameraStock(
  supabase: SupabaseClient
): Promise<FieldCameraStockRow[]> {
  const { data, error } = await supabase.rpc('get_my_field_camera_stock')
  if (error) {
    console.error('fetchMyFieldCameraStock:', error.message)
    return []
  }
  return (data ?? []).map((row: { camera_model_id: string; model_name: string; quantity: number | string }) => ({
    camera_model_id: row.camera_model_id,
    model_name: row.model_name,
    quantity: typeof row.quantity === 'string' ? parseInt(row.quantity, 10) : Number(row.quantity ?? 0),
  }))
}

export async function fetchSpecialistStockSummary(
  supabase: SupabaseClient
): Promise<SpecialistStockSummaryRow[]> {
  const [
    { data: specialists },
    { data: locations },
    { data: balances },
    { data: dealerLinks },
    { data: dealers },
    { data: cameras },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('role', 'specialist').order('full_name'),
    supabase
      .from('inventory_locations')
      .select('id, specialist_profile_id, label')
      .eq('location_type', 'specialist'),
    supabase
      .from('inventory_balances_v2')
      .select('location_id, camera_model_id, quantity')
      .eq('location_type', 'specialist'),
    supabase.from('specialist_dealers').select('specialist_id, dealer_id'),
    supabase.from('dealers').select('id, name'),
    supabase.from('camera_models').select('id, name').eq('is_active', true),
  ])

  const dealerNameById = new Map((dealers ?? []).map((d) => [d.id, d.name as string]))
  const cameraNameById = new Map((cameras ?? []).map((c) => [c.id, c.name as string]))
  const locationBySpecialist = new Map(
    (locations ?? []).map((l) => [l.specialist_profile_id as string, l.id as string])
  )

  const dealersBySpecialist = new Map<string, string[]>()
  for (const link of dealerLinks ?? []) {
    const sid = link.specialist_id as string
    const name = dealerNameById.get(link.dealer_id as string) ?? 'Unknown'
    const list = dealersBySpecialist.get(sid) ?? []
    list.push(name)
    dealersBySpecialist.set(sid, list)
  }

  const balancesByLocation = new Map<string, { camera_model_id: string; quantity: number }[]>()
  for (const b of balances ?? []) {
    if (!b.camera_model_id) continue
    const qty =
      typeof b.quantity === 'string' ? parseInt(b.quantity, 10) : Number(b.quantity ?? 0)
    if (qty === 0) continue
    const locId = b.location_id as string
    const list = balancesByLocation.get(locId) ?? []
    list.push({ camera_model_id: b.camera_model_id as string, quantity: qty })
    balancesByLocation.set(locId, list)
  }

  return (specialists ?? []).map((s) => {
    const locationId = locationBySpecialist.get(s.id) ?? ''
    const rawBalances = locationId ? (balancesByLocation.get(locationId) ?? []) : []
    const balanceRows = rawBalances.map((b) => ({
      camera_model_id: b.camera_model_id,
      model_name: cameraNameById.get(b.camera_model_id) ?? b.camera_model_id.slice(0, 8),
      quantity: b.quantity,
    }))
    return {
      specialist_id: s.id,
      specialist_name: (s.full_name as string) ?? s.id.slice(0, 8),
      location_id: locationId,
      dealer_names: dealersBySpecialist.get(s.id) ?? [],
      balances: balanceRows,
      total_units: balanceRows.reduce((sum, b) => sum + b.quantity, 0),
    }
  })
}
