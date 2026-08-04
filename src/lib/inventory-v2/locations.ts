import type { SupabaseClient } from '@supabase/supabase-js'
import type { DealerInventoryContext, InventoryLocation } from './types'

export async function getNationalLocationId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from('inventory_locations')
    .select('id')
    .eq('location_type', 'national')
    .maybeSingle()
  return data?.id ?? null
}

export async function ensureDealerLocation(
  supabase: SupabaseClient,
  dealerId: string,
  dealerName?: string | null
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('inventory_locations')
    .select('id')
    .eq('location_type', 'dealer')
    .eq('dealer_id', dealerId)
    .maybeSingle()
  if (existing?.id) return existing.id

  const label = `${dealerName?.trim() || 'Dealer'} — Dealer Stock`
  const { data: created, error } = await supabase
    .from('inventory_locations')
    .insert({ location_type: 'dealer', dealer_id: dealerId, label })
    .select('id')
    .single()
  if (error) return null
  return created.id
}

export async function ensureSpecialistLocation(
  supabase: SupabaseClient,
  specialistProfileId: string,
  specialistName?: string | null
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('inventory_locations')
    .select('id')
    .eq('location_type', 'specialist')
    .eq('specialist_profile_id', specialistProfileId)
    .maybeSingle()
  if (existing?.id) return existing.id

  const label = `${specialistName?.trim() || 'Specialist'} — Field Stock`
  const { data: created, error } = await supabase
    .from('inventory_locations')
    .insert({
      location_type: 'specialist',
      specialist_profile_id: specialistProfileId,
      label,
    })
    .select('id')
    .single()
  if (error) return null
  return created.id
}

export async function resolveDealerInventoryContext(
  supabase: SupabaseClient,
  dealerId: string
): Promise<DealerInventoryContext> {
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id, name, inventory_region_id, inventory_regions(city_id, province_id)')
    .eq('id', dealerId)
    .maybeSingle()

  const region = dealer?.inventory_regions as { city_id: string; province_id: string } | null | undefined
  const dealerLocationId = await ensureDealerLocation(supabase, dealerId, dealer?.name)

  return {
    dealerId,
    dealerLocationId,
    inventoryRegionId: dealer?.inventory_region_id ?? null,
    inventoryCityId: region?.city_id ?? null,
    inventoryProvinceId: region?.province_id ?? null,
  }
}

export async function listLocations(
  supabase: SupabaseClient,
  locationType?: InventoryLocation['location_type']
): Promise<InventoryLocation[]> {
  let query = supabase
    .from('inventory_locations')
    .select('id, location_type, province_id, region_id, dealer_id, specialist_profile_id, label')
    .order('label')
  if (locationType) query = query.eq('location_type', locationType)
  const { data } = await query
  return (data ?? []) as InventoryLocation[]
}
