import type { InventoryStockAlert } from '@/lib/inventory-stock-alerts'

export type InventoryAlertRuleType =
  | 'qty_below'
  | 'qty_above'
  | 'days_cover_below'
  | 'qty_negative'
  | 'dealer_total_below'

export type InventoryAlertLocationScope =
  | 'any'
  | 'national'
  | 'dealer'
  | 'province'
  | 'city'
  | 'region'
  | 'dealer_one'

export type InventoryAlertRule = {
  id: string
  name: string
  rule_type: InventoryAlertRuleType
  location_scope: InventoryAlertLocationScope
  location_id: string | null
  province_id: string | null
  city_id: string | null
  region_id: string | null
  dealer_id: string | null
  camera_model_id: string | null
  threshold_value: number
  severity: 'warning' | 'info'
  is_active: boolean
  notify_in_app: boolean
  notify_email: boolean
  created_at: string
}

export const RULE_TYPE_LABELS: Record<InventoryAlertRuleType, string> = {
  qty_below: 'Stok eşiğin altında',
  qty_above: 'Stok eşiğin üstünde',
  days_cover_below: 'Kapsama günü düşük (bayi)',
  qty_negative: 'Negatif stok',
  dealer_total_below: 'Bayi toplam stok düşük',
}

export const LOCATION_SCOPE_LABELS: Record<InventoryAlertLocationScope, string> = {
  any: 'Tüm konumlar (ulusal + bayi)',
  national: 'Kanada (ulusal stok)',
  dealer: 'Tüm bayiler',
  province: 'Eyalet',
  city: 'Şehir',
  region: 'İç bölge',
  dealer_one: 'Bayi',
}

type LocationRow = {
  id: string
  location_type: string
  label: string
  province_id: string | null
  city_id: string | null
  region_id: string | null
  dealer_id: string | null
}
type CameraRow = { id: string; name: string }
type CityRow = { id: string; name: string; province_id: string }
type RegionRow = { id: string; name: string; city_id: string; province_id: string }
type DealerRow = { id: string; name: string; inventory_region_id: string | null }

export type AlertEvalContext = {
  qtyByLocModel: Map<string, number>
  consumption30ByKey: Record<string, number>
  locations: LocationRow[]
  cameras: CameraRow[]
  cities: CityRow[]
  regions: RegionRow[]
  dealers: DealerRow[]
  dealerByLoc: Map<string, string | null>
  nationalLocationId: string | null
}

type ProvinceRow = { id: string; code: string; name: string }

export function formatAlertRuleGeoPath(
  rule: InventoryAlertRule,
  provinces: ProvinceRow[],
  cities: CityRow[],
  regions: RegionRow[],
  dealers: DealerRow[] = []
): string {
  if (rule.location_scope === 'any') return LOCATION_SCOPE_LABELS.any
  if (rule.location_scope === 'national') return 'Kanada'
  if (rule.location_scope === 'dealer') return LOCATION_SCOPE_LABELS.dealer

  const parts = ['Kanada']
  const provinceId =
    rule.province_id ??
    (rule.city_id ? cities.find((c) => c.id === rule.city_id)?.province_id : null) ??
    (rule.region_id ? regions.find((r) => r.id === rule.region_id)?.province_id : null)

  if (provinceId) {
    const p = provinces.find((x) => x.id === provinceId)
    if (p) parts.push(p.code)
  }
  if (rule.city_id) {
    const c = cities.find((x) => x.id === rule.city_id)
    if (c) parts.push(c.name)
  }
  if (rule.region_id) {
    const r = regions.find((x) => x.id === rule.region_id)
    if (r) parts.push(r.name)
  }
  if (rule.dealer_id) {
    const d = dealers.find((x) => x.id === rule.dealer_id)
    if (d) parts.push(d.name)
  }
  return parts.join(' → ')
}

function balanceKey(locationId: string, modelId: string) {
  return `${locationId}:${modelId}`
}

function dealerIdsInScope(rule: InventoryAlertRule, ctx: AlertEvalContext): string[] {
  if (rule.location_scope === 'dealer_one' && rule.dealer_id) {
    return [rule.dealer_id]
  }
  if (rule.location_scope === 'dealer' || rule.location_scope === 'any') {
    return ctx.dealers.map((d) => d.id)
  }
  if (rule.location_scope === 'region' && rule.region_id) {
    return ctx.dealers.filter((d) => d.inventory_region_id === rule.region_id).map((d) => d.id)
  }
  if (rule.location_scope === 'city' && rule.city_id) {
    const regionIds = new Set(ctx.regions.filter((r) => r.city_id === rule.city_id).map((r) => r.id))
    return ctx.dealers.filter((d) => d.inventory_region_id && regionIds.has(d.inventory_region_id)).map((d) => d.id)
  }
  if (rule.location_scope === 'province' && rule.province_id) {
    const regionIds = new Set(
      ctx.regions.filter((r) => r.province_id === rule.province_id).map((r) => r.id)
    )
    return ctx.dealers
      .filter((d) => d.inventory_region_id && regionIds.has(d.inventory_region_id))
      .map((d) => d.id)
  }
  return []
}

function stockLocationsInScope(rule: InventoryAlertRule, ctx: AlertEvalContext): LocationRow[] {
  const out: LocationRow[] = []
  const push = (loc: LocationRow | undefined) => {
    if (loc && !out.some((x) => x.id === loc.id)) out.push(loc)
  }

  switch (rule.location_scope) {
    case 'national':
      push(ctx.locations.find((l) => l.location_type === 'national'))
      break
    case 'dealer':
      ctx.locations.filter((l) => l.location_type === 'dealer').forEach((l) => push(l))
      break
    case 'province': {
      if (!rule.province_id) break
      push(ctx.locations.find((l) => l.location_type === 'province' && l.province_id === rule.province_id))
      for (const city of ctx.cities.filter((c) => c.province_id === rule.province_id)) {
        push(ctx.locations.find((l) => l.location_type === 'city' && l.city_id === city.id))
        for (const region of ctx.regions.filter((r) => r.city_id === city.id)) {
          push(ctx.locations.find((l) => l.location_type === 'region' && l.region_id === region.id))
        }
      }
      for (const dealerId of dealerIdsInScope(rule, ctx)) {
        push(ctx.locations.find((l) => l.location_type === 'dealer' && l.dealer_id === dealerId))
      }
      break
    }
    case 'city': {
      if (!rule.city_id) break
      push(ctx.locations.find((l) => l.location_type === 'city' && l.city_id === rule.city_id))
      for (const region of ctx.regions.filter((r) => r.city_id === rule.city_id)) {
        push(ctx.locations.find((l) => l.location_type === 'region' && l.region_id === region.id))
      }
      for (const dealerId of dealerIdsInScope(rule, ctx)) {
        push(ctx.locations.find((l) => l.location_type === 'dealer' && l.dealer_id === dealerId))
      }
      break
    }
    case 'region': {
      if (!rule.region_id) break
      push(ctx.locations.find((l) => l.location_type === 'region' && l.region_id === rule.region_id))
      for (const dealerId of dealerIdsInScope(rule, ctx)) {
        push(ctx.locations.find((l) => l.location_type === 'dealer' && l.dealer_id === dealerId))
      }
      break
    }
    case 'dealer_one': {
      if (!rule.dealer_id) break
      push(ctx.locations.find((l) => l.location_type === 'dealer' && l.dealer_id === rule.dealer_id))
      break
    }
    default:
      ctx.locations
        .filter((l) => l.location_type === 'national' || l.location_type === 'dealer')
        .forEach((l) => push(l))
  }

  return out
}

function resolveTargetLocations(rule: InventoryAlertRule, ctx: AlertEvalContext): LocationRow[] {
  return stockLocationsInScope(rule, ctx)
}

function resolveTargetCameras(rule: InventoryAlertRule, cameras: CameraRow[]): CameraRow[] {
  if (rule.camera_model_id) {
    const cam = cameras.find((c) => c.id === rule.camera_model_id)
    return cam ? [cam] : []
  }
  return cameras
}

function pushCustomAlert(out: InventoryStockAlert[], rule: InventoryAlertRule, detail: string) {
  out.push({
    level: rule.severity,
    title: rule.name,
    detail,
    source: 'custom',
    ruleId: rule.id,
    notifyInApp: rule.notify_in_app,
    notifyEmail: rule.notify_email,
  })
}

export function evaluateCustomAlertRules(
  rules: InventoryAlertRule[],
  ctx: AlertEvalContext
): InventoryStockAlert[] {
  const alerts: InventoryStockAlert[] = []
  const active = rules.filter((r) => r.is_active)

  for (const rule of active) {
    const threshold = Number(rule.threshold_value)

    if (rule.rule_type === 'dealer_total_below') {
      const dealerIds = dealerIdsInScope(rule, ctx)
      const dealerLocs = ctx.locations.filter(
        (l) => l.location_type === 'dealer' && l.dealer_id && dealerIds.includes(l.dealer_id)
      )
      const cams = resolveTargetCameras(rule, ctx.cameras)
      for (const cam of cams) {
        let total = 0
        for (const loc of dealerLocs) {
          total += ctx.qtyByLocModel.get(balanceKey(loc.id, cam.id)) ?? 0
        }
        if (total < threshold) {
          pushCustomAlert(alerts, rule, `${cam.name}: bayi toplam ${total}, eşik ${threshold}.`)
        }
      }
      continue
    }

    const targetLocs = resolveTargetLocations(rule, ctx)
    const targetCams = resolveTargetCameras(rule, ctx.cameras)

    for (const loc of targetLocs) {
      for (const cam of targetCams) {
        const qty = ctx.qtyByLocModel.get(balanceKey(loc.id, cam.id)) ?? 0

        if (rule.rule_type === 'qty_negative' && qty < 0) {
          pushCustomAlert(alerts, rule, `${loc.label} · ${cam.name}: stok ${qty}.`)
          continue
        }

        if (rule.rule_type === 'qty_below' && qty < threshold) {
          pushCustomAlert(
            alerts,
            rule,
            `${loc.label} · ${cam.name}: stok ${qty}, eşik ${threshold}.`
          )
          continue
        }

        if (rule.rule_type === 'qty_above' && qty > threshold) {
          pushCustomAlert(
            alerts,
            rule,
            `${loc.label} · ${cam.name}: stok ${qty}, eşik ${threshold}.`
          )
          continue
        }

        if (rule.rule_type === 'days_cover_below' && loc.location_type === 'dealer' && qty > 0) {
          const dealerId = ctx.dealerByLoc.get(loc.id)
          if (!dealerId) continue
          const consKey = `${dealerId}:${cam.id}`
          const cons = ctx.consumption30ByKey[consKey] ?? 0
          const dailyAvg = cons / 30
          if (dailyAvg < 0.05) continue
          const daysCover = qty / dailyAvg
          if (daysCover < threshold) {
            pushCustomAlert(
              alerts,
              rule,
              `${loc.label} · ${cam.name}: ~${daysCover.toFixed(1)} gün (${cons} kurulum / 30g, ${qty} stok), eşik ${threshold} gün.`
            )
          }
        }
      }
    }
  }

  return alerts
}
