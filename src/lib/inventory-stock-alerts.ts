import type { SupabaseClient } from '@supabase/supabase-js'
import { subDays } from 'date-fns'
import {
  evaluateCustomAlertRules,
  type InventoryAlertRule,
} from '@/lib/inventory-alert-rules'

export type InventoryStockAlert = {
  title: string
  detail: string
  level: 'info' | 'warning'
  source?: 'system' | 'custom'
  ruleId?: string
  notifyInApp?: boolean
  notifyEmail?: boolean
}

export type InventoryStockSummary = {
  shortSkuLines: number
  belowMinLines: number
  negModelRollups: number
  dealerQtyTotal: number
  nationalQtyTotal: number
  catalogModelCount: number
  warningCount: number
  infoCount: number
}

function balanceKey(locationId: string, modelId: string) {
  return `${locationId}:${modelId}`
}

/**
 * Inventory v2 alerts for Aurora Manager (dashboard + Inventory page).
 */
export async function fetchInventoryStockAlerts(supabase: SupabaseClient): Promise<{
  alerts: InventoryStockAlert[]
  summary: InventoryStockSummary
  consumption30ByKey: Record<string, number>
  overallByModel: Record<string, number>
  thresholds: { location_id: string; camera_model_id: string; min_qty: number }[]
  customRules: InventoryAlertRule[]
}> {
  const since = subDays(new Date(), 30).toISOString()

  const [
    locationsRes,
    camerasRes,
    balancesRes,
    thresholdsRes,
    consumptionRes,
    nationalLocRes,
    dealersRes,
    citiesRes,
    regionsRes,
    customRulesRes,
  ] = await Promise.all([
    supabase
      .from('inventory_locations')
      .select('id, location_type, label, province_id, city_id, region_id, dealer_id')
      .in('location_type', ['national', 'province', 'city', 'region', 'dealer']),
    supabase.from('camera_models').select('id, name').order('name'),
    supabase
      .from('inventory_balances_v2')
      .select('location_id, location_type, camera_model_id, quantity'),
    supabase.from('inventory_thresholds').select('location_id, camera_model_id, min_qty'),
    supabase
      .from('inventory_movements_v2')
      .select('from_location_id, camera_model_id')
      .eq('movement_type', 'consumption')
      .gte('created_at', since),
    supabase.from('inventory_locations').select('id').eq('location_type', 'national').maybeSingle(),
    supabase.from('dealers').select('id, name, inventory_region_id'),
    supabase.from('inventory_cities').select('id, name, province_id'),
    supabase.from('inventory_regions').select('id, name, city_id, province_id'),
    supabase
      .from('inventory_alert_rules')
      .select(
        `id, name, rule_type, location_scope, location_id, province_id, city_id, region_id, dealer_id,
         camera_model_id, threshold_value, severity, is_active, notify_in_app, notify_email, created_at`
      )
      .order('created_at', { ascending: false }),
  ])

  type LocationRow = {
    id: string
    location_type: string
    label: string
    province_id: string | null
    city_id: string | null
    region_id: string | null
    dealer_id: string | null
  }
  type BalanceRow = {
    location_id: string
    location_type: string
    camera_model_id: string
    quantity: string | number | null
  }
  type ThresholdRow = { location_id: string; camera_model_id: string; min_qty: number }

  const locations = (locationsRes.data ?? []) as LocationRow[]
  const cameras = camerasRes.data ?? []
  const balances = (balancesRes.data ?? []) as BalanceRow[]
  const thresholds = (thresholdsRes.data ?? []) as ThresholdRow[]
  const nationalLocationId = nationalLocRes.data?.id ?? null

  const locById = new Map(locations.map((l) => [l.id, l]))
  const dealerByLoc = new Map(
    locations.filter((l) => l.location_type === 'dealer').map((l) => [l.id, l.dealer_id])
  )
  const cameraById = new Map(cameras.map((c) => [c.id, c]))

  const consumption30ByKey: Record<string, number> = {}
  for (const row of consumptionRes.data ?? []) {
    const dealerId = dealerByLoc.get((row as { from_location_id: string }).from_location_id)
    if (!dealerId) continue
    const k = balanceKey(dealerId, (row as { camera_model_id: string }).camera_model_id)
    consumption30ByKey[k] = (consumption30ByKey[k] ?? 0) + 1
  }

  const qtyByLocModel = new Map<string, number>()
  for (const b of balances) {
    if (!b.camera_model_id) continue
    const q = typeof b.quantity === 'string' ? parseInt(b.quantity, 10) : Number(b.quantity ?? 0)
    qtyByLocModel.set(balanceKey(b.location_id, b.camera_model_id), Number.isFinite(q) ? q : 0)
  }

  let shortSkuLines = 0
  for (const q of qtyByLocModel.values()) {
    if (q < 0) shortSkuLines += 1
  }

  const dealerBalances = balances.filter((b) => b.location_type === 'dealer' && b.camera_model_id)
  const overallByModel = new Map<string, number>()
  for (const b of dealerBalances) {
    const q = qtyByLocModel.get(balanceKey(b.location_id, b.camera_model_id)) ?? 0
    overallByModel.set(b.camera_model_id, (overallByModel.get(b.camera_model_id) ?? 0) + q)
  }

  let negModelRollups = 0
  for (const q of overallByModel.values()) {
    if (q < 0) negModelRollups += 1
  }

  let belowMinLines = 0
  for (const t of thresholds) {
    const qty = qtyByLocModel.get(balanceKey(t.location_id, t.camera_model_id)) ?? 0
    if (qty < t.min_qty) belowMinLines += 1
  }

  let dealerQtyTotal = 0
  for (const b of dealerBalances) {
    dealerQtyTotal += qtyByLocModel.get(balanceKey(b.location_id, b.camera_model_id)) ?? 0
  }

  let nationalQtyTotal = 0
  if (nationalLocationId) {
    for (const c of cameras) {
      nationalQtyTotal += qtyByLocModel.get(balanceKey(nationalLocationId, c.id)) ?? 0
    }
  }

  const alerts: InventoryStockAlert[] = []

  if (shortSkuLines > 0) {
    alerts.push({
      level: 'warning',
      title: `${shortSkuLines} balance row(s) negative`,
      detail:
        'On-hand at a location × model is below zero. Post receipts or adjustments via Inventory.',
      source: 'system',
      notifyInApp: true,
      notifyEmail: true,
    })
  }

  if (negModelRollups > 0) {
    alerts.push({
      level: 'warning',
      title: `${negModelRollups} camera model(s) with negative dealer total`,
      detail: 'Field stock is short when summed across all dealers for those models.',
      source: 'system',
      notifyInApp: true,
      notifyEmail: true,
    })
  }

  if (dealerQtyTotal < 0) {
    alerts.push({
      level: 'warning',
      title: 'Dealer stock is net negative system-wide',
      detail: `Sum of all dealer rows is ${dealerQtyTotal}.`,
      source: 'system',
      notifyInApp: true,
      notifyEmail: true,
    })
  }

  if (nationalLocationId) {
    for (const c of cameras) {
      const qty = qtyByLocModel.get(balanceKey(nationalLocationId, c.id)) ?? 0
      const t = thresholds.find(
        (x) => x.location_id === nationalLocationId && x.camera_model_id === c.id
      )
      if (t && qty < t.min_qty) {
        alerts.push({
          level: 'warning',
          title: `National low — ${c.name}`,
          detail: `On hand ${qty}, min ${t.min_qty}.`,
          source: 'system',
          notifyInApp: true,
          notifyEmail: true,
        })
      }
    }
  }

  for (const t of thresholds) {
    const qty = qtyByLocModel.get(balanceKey(t.location_id, t.camera_model_id)) ?? 0
    const loc = locById.get(t.location_id)
    const cam = cameraById.get(t.camera_model_id)
    if (qty >= t.min_qty) continue
    if (loc?.location_type === 'national') continue
    alerts.push({
      level: 'warning',
      title: `Below minimum — ${loc?.label ?? 'Location'}`,
      detail: `${cam?.name ?? 'Camera'}: on hand ${qty}, min ${t.min_qty}.`,
      source: 'system',
      notifyInApp: true,
      notifyEmail: true,
    })
  }

  for (const b of dealerBalances) {
    const dealerId = dealerByLoc.get(b.location_id)
    if (!dealerId) continue
    const key = balanceKey(dealerId, b.camera_model_id)
    const qty = qtyByLocModel.get(balanceKey(b.location_id, b.camera_model_id)) ?? 0
    if (qty <= 0) continue
    const cons = consumption30ByKey[key] ?? 0
    const dailyAvg = cons / 30
    if (dailyAvg < 0.05) continue
    const daysCover = qty / dailyAvg
    if (daysCover < 7) {
      const loc = locById.get(b.location_id)
      const cam = cameraById.get(b.camera_model_id)
      alerts.push({
        level: 'info',
        title: `Low coverage — ${loc?.label ?? 'Dealer'}`,
        detail: `${cam?.name ?? 'Camera'}: ~${daysCover.toFixed(1)} days (${cons} installs / 30d, ${qty} on hand).`,
        source: 'system',
        notifyInApp: true,
        notifyEmail: true,
      })
    }
  }

  const customRules: InventoryAlertRule[] = (customRulesRes.data ?? []).map((r) => ({
    ...r,
    threshold_value: Number(r.threshold_value),
  })) as InventoryAlertRule[]

  const customAlerts = evaluateCustomAlertRules(customRules, {
    qtyByLocModel,
    consumption30ByKey,
    locations,
    cameras,
    cities: (citiesRes.data ?? []) as { id: string; name: string; province_id: string }[],
    regions: (regionsRes.data ?? []) as { id: string; name: string; city_id: string; province_id: string }[],
    dealers: (dealersRes.data ?? []) as { id: string; name: string; inventory_region_id: string | null }[],
    dealerByLoc,
    nationalLocationId,
  })
  alerts.push(...customAlerts)

  const warningCount = alerts.filter((a) => a.level === 'warning').length
  const infoCount = alerts.filter((a) => a.level === 'info').length

  return {
    alerts,
    summary: {
      shortSkuLines,
      belowMinLines,
      negModelRollups,
      dealerQtyTotal,
      nationalQtyTotal,
      catalogModelCount: cameras.length,
      warningCount,
      infoCount,
    },
    consumption30ByKey,
    overallByModel: Object.fromEntries(overallByModel),
    thresholds,
    customRules,
  }
}
