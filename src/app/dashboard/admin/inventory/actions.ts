'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  recordAdjustment,
  recordAllocation,
  recordReceipt,
  recordReturnToUpstream,
  recordTransfer,
} from '@/lib/inventory-v2/movements'
import { ensureDealerLocation, ensureSpecialistLocation } from '@/lib/inventory-v2/locations'

async function requireAuroraManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, supabase, userId: null }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can manage inventory' as const, supabase, userId: null }
  }
  return { supabase, userId: user.id }
}

function friendlyGeoDuplicateError(
  error: { code?: string; message?: string },
  kind: 'city' | 'region'
): string {
  if (error.code === '23505') {
    if (kind === 'city') {
      return 'This city code already exists for the selected province. BC / Vancouver (VAN) is pre-configured — open Stock tree to use it, or choose a different code for another city.'
    }
    return 'This inner region code already exists for the selected city. Pick a different code or use the existing region in Stock tree.'
  }
  return error.message ?? 'Could not save geography.'
}

export async function postInventoryReceipt(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase, userId } = auth

  const toLocationId = String(formData.get('to_location_id') ?? '').trim()
  const cameraModelId = String(formData.get('camera_model_id') ?? '').trim()
  const quantity = parseInt(String(formData.get('quantity') ?? ''), 10)
  const note = String(formData.get('note') ?? '').trim() || null

  if (!toLocationId || !cameraModelId) return { error: 'Location and camera model are required' }
  if (!Number.isFinite(quantity) || quantity < 1) return { error: 'Quantity must be at least 1' }

  const result = await recordReceipt(supabase, {
    toLocationId,
    cameraModelId,
    quantity,
    note,
    createdBy: userId,
  })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function postInventoryAllocation(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase, userId } = auth

  const fromLocationId = String(formData.get('from_location_id') ?? '').trim()
  const toLocationId = String(formData.get('to_location_id') ?? '').trim()
  const cameraModelId = String(formData.get('camera_model_id') ?? '').trim()
  const quantity = parseInt(String(formData.get('quantity') ?? ''), 10)
  const note = String(formData.get('note') ?? '').trim() || null

  if (!fromLocationId || !toLocationId || !cameraModelId) {
    return { error: 'Source, destination, and camera model are required' }
  }
  if (!Number.isFinite(quantity) || quantity < 1) return { error: 'Quantity must be at least 1' }

  const result = await recordAllocation(supabase, {
    fromLocationId,
    toLocationId,
    cameraModelId,
    quantity,
    note,
    createdBy: userId,
  })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function postInventoryTransfer(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase, userId } = auth

  const fromLocationId = String(formData.get('from_location_id') ?? '').trim()
  const toLocationId = String(formData.get('to_location_id') ?? '').trim()
  const cameraModelId = String(formData.get('camera_model_id') ?? '').trim()
  const quantity = parseInt(String(formData.get('quantity') ?? ''), 10)
  const note = String(formData.get('note') ?? '').trim() || null

  if (!fromLocationId || !toLocationId || !cameraModelId) {
    return { error: 'Source, destination, and camera model are required' }
  }
  if (!Number.isFinite(quantity) || quantity < 1) return { error: 'Quantity must be at least 1' }

  const result = await recordTransfer(supabase, {
    fromLocationId,
    toLocationId,
    cameraModelId,
    quantity,
    note,
    createdBy: userId,
  })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function postDealerToSpecialistTransfer(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase, userId } = auth

  const dealerId = String(formData.get('dealer_id') ?? '').trim()
  const specialistProfileId = String(formData.get('specialist_profile_id') ?? '').trim()
  const cameraModelId = String(formData.get('camera_model_id') ?? '').trim()
  const quantity = parseInt(String(formData.get('quantity') ?? ''), 10)
  const note = String(formData.get('note') ?? '').trim() || null

  if (!dealerId || !specialistProfileId || !cameraModelId) {
    return { error: 'Dealer, specialist, and camera model are required' }
  }
  if (!Number.isFinite(quantity) || quantity < 1) return { error: 'Quantity must be at least 1' }

  const [{ data: dealer }, { data: specialist }] = await Promise.all([
    supabase.from('dealers').select('name').eq('id', dealerId).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', specialistProfileId).maybeSingle(),
  ])

  const fromLocationId = await ensureDealerLocation(supabase, dealerId, dealer?.name)
  const toLocationId = await ensureSpecialistLocation(
    supabase,
    specialistProfileId,
    specialist?.full_name
  )
  if (!fromLocationId || !toLocationId) return { error: 'Could not resolve inventory locations' }

  const result = await recordTransfer(supabase, {
    fromLocationId,
    toLocationId,
    cameraModelId,
    quantity,
    note,
    createdBy: userId,
  })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function postInventoryAdjustment(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase, userId } = auth

  const locationId = String(formData.get('location_id') ?? '').trim()
  const cameraModelId = String(formData.get('camera_model_id') ?? '').trim()
  const quantityDelta = parseInt(String(formData.get('quantity_delta') ?? ''), 10)
  const note = String(formData.get('note') ?? '').trim() || null

  if (!locationId || !cameraModelId) return { error: 'Location and camera model are required' }
  if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
    return { error: 'Adjustment delta must be a non-zero integer' }
  }

  const result = await recordAdjustment(supabase, {
    locationId,
    cameraModelId,
    quantityDelta,
    note,
    createdBy: userId,
  })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function postInventoryReturn(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase, userId } = auth

  const fromLocationId = String(formData.get('from_location_id') ?? '').trim()
  const toLocationId = String(formData.get('to_location_id') ?? '').trim()
  const cameraModelId = String(formData.get('camera_model_id') ?? '').trim()
  const quantity = parseInt(String(formData.get('quantity') ?? ''), 10)
  const note = String(formData.get('note') ?? '').trim() || null

  if (!fromLocationId || !toLocationId || !cameraModelId) {
    return { error: 'Source, destination, and camera model are required' }
  }
  if (!Number.isFinite(quantity) || quantity < 1) return { error: 'Quantity must be at least 1' }

  const result = await recordReturnToUpstream(supabase, {
    fromLocationId,
    toLocationId,
    cameraModelId,
    quantity,
    note,
    createdBy: userId,
  })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function upsertInventoryThreshold(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase } = auth

  const locationId = String(formData.get('location_id') ?? '').trim()
  const cameraModelId = String(formData.get('camera_model_id') ?? '').trim()
  const minQty = parseInt(String(formData.get('min_qty') ?? '0'), 10)

  if (!locationId || !cameraModelId) return { error: 'Location and camera model are required' }
  if (!Number.isFinite(minQty) || minQty < 0) return { error: 'Minimum quantity must be 0 or greater' }

  const { error } = await supabase.from('inventory_thresholds').upsert(
    {
      location_id: locationId,
      camera_model_id: cameraModelId,
      min_qty: minQty,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'location_id,camera_model_id' }
  )
  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function upsertInventoryPricingRule(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase } = auth

  const scopeType = String(formData.get('scope_type') ?? '').trim()
  const scopeIdRaw = String(formData.get('scope_id') ?? '').trim()
  const cameraModelIdRaw = String(formData.get('camera_model_id') ?? '').trim()
  const serviceType = String(formData.get('service_type') ?? '').trim()
  const price = parseFloat(String(formData.get('price_cad') ?? ''))

  if (!['national', 'province', 'city', 'region', 'dealer'].includes(scopeType)) {
    return { error: 'Invalid pricing scope' }
  }
  if (!['installation', 'transfer', 'removal'].includes(serviceType)) {
    return { error: 'Invalid service type' }
  }
  if (!Number.isFinite(price) || price < 0) return { error: 'Price must be 0 or greater' }

  const scopeId = scopeType === 'national' || !scopeIdRaw ? null : scopeIdRaw
  const cameraModelId =
    serviceType === 'installation' && cameraModelIdRaw ? cameraModelIdRaw : null

  if (scopeType !== 'national' && !scopeId) {
    return { error: 'Scope entity is required for non-national pricing' }
  }
  if (serviceType === 'installation' && !cameraModelId) {
    return { error: 'Camera model is required for installation pricing' }
  }

  let existingQuery = supabase
    .from('inventory_pricing_rules')
    .select('id')
    .eq('scope_type', scopeType)
    .eq('service_type', serviceType)

  if (scopeId) existingQuery = existingQuery.eq('scope_id', scopeId)
  else existingQuery = existingQuery.is('scope_id', null)

  if (cameraModelId) existingQuery = existingQuery.eq('camera_model_id', cameraModelId)
  else existingQuery = existingQuery.is('camera_model_id', null)

  const { data: existing } = await existingQuery.maybeSingle()

  const row = {
    scope_type: scopeType,
    scope_id: scopeId,
    camera_model_id: cameraModelId,
    service_type: serviceType,
    price_cad: price,
    updated_at: new Date().toISOString(),
  }

  const { error } = existing?.id
    ? await supabase.from('inventory_pricing_rules').update(row).eq('id', existing.id)
    : await supabase.from('inventory_pricing_rules').insert(row)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
}

export async function createInventoryCity(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase } = auth

  const provinceId = String(formData.get('province_id') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const name = String(formData.get('name') ?? '').trim()

  if (!provinceId || !code || !name) return { error: 'Province, code, and name are required' }

  const { data: existing } = await supabase
    .from('inventory_cities')
    .select('id, name')
    .eq('province_id', provinceId)
    .eq('code', code)
    .maybeSingle()

  if (existing) {
    return {
      error: `"${existing.name}" (${code}) already exists for this province. Go to Stock tree → select it, or use a different code.`,
    }
  }

  const { error } = await supabase.from('inventory_cities').insert({ province_id: provinceId, code, name })
  if (error) return { error: friendlyGeoDuplicateError(error, 'city') }
  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard/system-management/dealer')
  return { success: true }
}

export async function createInventoryRegion(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase } = auth

  const cityId = String(formData.get('city_id') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const name = String(formData.get('name') ?? '').trim()

  if (!cityId || !code || !name) return { error: 'City, code, and name are required' }

  const { data: city } = await supabase.from('inventory_cities').select('province_id').eq('id', cityId).maybeSingle()
  if (!city?.province_id) return { error: 'City not found' }

  const { data: existingRegion } = await supabase
    .from('inventory_regions')
    .select('id, name')
    .eq('city_id', cityId)
    .eq('code', code)
    .maybeSingle()

  if (existingRegion) {
    return {
      error: `"${existingRegion.name}" (${code}) already exists for this city. Use Stock tree or pick a different code.`,
    }
  }

  const { error } = await supabase.from('inventory_regions').insert({
    city_id: cityId,
    province_id: city.province_id,
    code,
    name,
  })
  if (error) return { error: friendlyGeoDuplicateError(error, 'region') }
  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard/system-management/dealer')
  return { success: true }
}

export async function resetInventoryV2Data(): Promise<{
  error?: string
  success?: string
  movements_deleted?: number
}> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase } = auth

  const { data, error } = await supabase.rpc('reset_inventory_v2_data')
  if (error) return { error: error.message }

  const row = data as { movements_deleted?: number; success?: boolean } | null
  const n = typeof row?.movements_deleted === 'number' ? row.movements_deleted : undefined
  const suffix = n != null ? ` (${n} movement row(s) removed.)` : ''
  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: `Inventory v2 ledger cleared.${suffix}`, movements_deleted: n }
}

const ALERT_RULE_TYPES = new Set([
  'qty_below',
  'qty_above',
  'days_cover_below',
  'qty_negative',
  'dealer_total_below',
])
const ALERT_LOCATION_SCOPES = new Set(['any', 'national', 'dealer', 'province', 'city', 'region', 'dealer_one'])

export async function createInventoryAlertRule(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase, userId } = auth

  const name = String(formData.get('name') ?? '').trim()
  const ruleType = String(formData.get('rule_type') ?? '').trim()
  const locationScope = String(formData.get('location_scope') ?? 'any').trim()
  const provinceIdRaw = String(formData.get('province_id') ?? '').trim()
  const cityIdRaw = String(formData.get('city_id') ?? '').trim()
  const regionIdRaw = String(formData.get('region_id') ?? '').trim()
  const dealerIdRaw = String(formData.get('dealer_id') ?? '').trim()
  const cameraModelIdRaw = String(formData.get('camera_model_id') ?? '').trim()
  const thresholdValue = parseFloat(String(formData.get('threshold_value') ?? '0'))
  const severity = String(formData.get('severity') ?? 'warning').trim()
  const notifyInApp = formData.get('notify_in_app') === 'on'
  const notifyEmail = formData.get('notify_email') === 'on'

  if (!name) return { error: 'Rule name is required' }
  if (!ALERT_RULE_TYPES.has(ruleType)) return { error: 'Invalid rule type' }
  if (!ALERT_LOCATION_SCOPES.has(locationScope)) return { error: 'Invalid location scope' }
  if (locationScope === 'province' && !provinceIdRaw) {
    return { error: 'Eyalet seçin (Kanada → BC …)' }
  }
  if (locationScope === 'city' && !cityIdRaw) {
    return { error: 'Şehir seçin (Kanada → BC → Vancouver …)' }
  }
  if (locationScope === 'region' && !regionIdRaw) {
    return { error: 'İç bölge seçin (Kanada → BC → Vancouver → East Vancouver …)' }
  }
  if (locationScope === 'dealer_one') {
    if (!regionIdRaw) return { error: 'Bayi seçimi için iç bölge gerekli' }
    if (!dealerIdRaw) return { error: 'Bayi seçin' }
  }
  if (!Number.isFinite(thresholdValue) || thresholdValue < 0) {
    return { error: 'Threshold must be 0 or greater' }
  }
  if (severity !== 'warning' && severity !== 'info') return { error: 'Invalid severity' }

  let provinceId: string | null = null
  let cityId: string | null = null
  let regionId: string | null = null
  let dealerId: string | null = null

  if (locationScope === 'province') provinceId = provinceIdRaw
  if (locationScope === 'city') {
    cityId = cityIdRaw
    provinceId = provinceIdRaw || null
  }
  if (locationScope === 'region') {
    regionId = regionIdRaw
    cityId = cityIdRaw || null
    provinceId = provinceIdRaw || null
  }
  if (locationScope === 'dealer_one') {
    dealerId = dealerIdRaw
    regionId = regionIdRaw
    cityId = cityIdRaw || null
    provinceId = provinceIdRaw || null
  }

  const { error } = await supabase.from('inventory_alert_rules').insert({
    name,
    rule_type: ruleType,
    location_scope: locationScope,
    location_id: null,
    province_id: provinceId,
    city_id: cityId,
    region_id: regionId,
    dealer_id: dealerId,
    camera_model_id: cameraModelIdRaw || null,
    threshold_value: thresholdValue,
    severity,
    notify_in_app: notifyInApp,
    notify_email: notifyEmail,
    created_by: userId,
  })
  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function toggleInventoryAlertRule(
  ruleId: string,
  isActive: boolean
): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase } = auth

  if (!ruleId) return { error: 'Rule id required' }

  const { error } = await supabase
    .from('inventory_alert_rules')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', ruleId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteInventoryAlertRule(ruleId: string): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { supabase } = auth

  if (!ruleId) return { error: 'Rule id required' }

  const { error } = await supabase.from('inventory_alert_rules').delete().eq('id', ruleId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard')
  return { success: true }
}
