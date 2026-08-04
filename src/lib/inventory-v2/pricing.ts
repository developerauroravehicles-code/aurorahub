import type { SupabaseClient } from '@supabase/supabase-js'
import type { InventoryServiceType, PricingScopeType } from './types'
import { resolveDealerInventoryContext } from './locations'

export type ResolvePriceInput = {
  dealerId: string | null
  regionId?: string | null
  cityId?: string | null
  provinceId?: string | null
  cameraModelId?: string | null
  serviceType: InventoryServiceType
}

const CASCADE: PricingScopeType[] = ['dealer', 'region', 'province', 'national']

async function fetchRulesForScope(
  supabase: SupabaseClient,
  scopeType: PricingScopeType,
  scopeId: string | null,
  serviceType: InventoryServiceType,
  cameraModelId: string | null
) {
  let query = supabase
    .from('inventory_pricing_rules')
    .select('price_cad')
    .eq('scope_type', scopeType)
    .eq('service_type', serviceType)

  if (scopeType === 'national') {
    query = query.is('scope_id', null)
  } else if (scopeId) {
    query = query.eq('scope_id', scopeId)
  } else {
    return null
  }

  if (serviceType === 'installation') {
    if (!cameraModelId) return null
    query = query.eq('camera_model_id', cameraModelId)
  } else {
    query = query.is('camera_model_id', null)
  }

  const { data, error } = await query.maybeSingle()
  if (error || !data) return null
  const price = Number(data.price_cad)
  return Number.isFinite(price) ? price : null
}

export async function resolveInventoryPrice(
  supabase: SupabaseClient,
  input: ResolvePriceInput
): Promise<{ amount: number; scope: PricingScopeType } | { error: string }> {
  const { serviceType, dealerId } = input
  let regionId = input.regionId ?? null
  let cityId = input.cityId ?? null
  let provinceId = input.provinceId ?? null

  if (dealerId && (!regionId || !cityId || !provinceId)) {
    const ctx = await resolveDealerInventoryContext(supabase, dealerId)
    regionId = regionId ?? ctx.inventoryRegionId
    cityId = cityId ?? ctx.inventoryCityId
    provinceId = provinceId ?? ctx.inventoryProvinceId
  }

  const scopes: { type: PricingScopeType; id: string | null }[] = [
    { type: 'dealer', id: dealerId },
    { type: 'region', id: regionId },
    { type: 'city', id: cityId },
    { type: 'province', id: provinceId },
    { type: 'national', id: null },
  ]

  for (const scope of scopes) {
    if (scope.type !== 'national' && !scope.id) continue
    const price = await fetchRulesForScope(
      supabase,
      scope.type,
      scope.id,
      serviceType,
      input.cameraModelId ?? null
    )
    if (price != null) return { amount: price, scope: scope.type }
  }

  if (serviceType === 'installation') {
    return { error: 'No installation price configured for this dealer/model in the pricing cascade.' }
  }
  return { error: `No ${serviceType} fee configured in inventory pricing.` }
}

export async function fetchNationalServiceFees(
  supabase: SupabaseClient
): Promise<{ transfer: number | null; removal: number | null }> {
  const [transfer, removal] = await Promise.all([
    fetchRulesForScope(supabase, 'national', null, 'transfer', null),
    fetchRulesForScope(supabase, 'national', null, 'removal', null),
  ])
  return { transfer, removal }
}
