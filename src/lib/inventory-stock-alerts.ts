import type { SupabaseClient } from '@supabase/supabase-js'
import { subDays } from 'date-fns'

export type InventoryStockAlert = { title: string; detail: string; level: 'info' | 'warning' }

export type InventoryStockSummary = {
  shortSkuLines: number
  belowMinLines: number
  negModelRollups: number
  dealerQtyTotal: number
  catalogModelCount: number
  warningCount: number
  infoCount: number
}

function consumptionKey(dealerId: string, modelId: string) {
  return `${dealerId}:${modelId}`
}

/**
 * Inventory alerts for Aurora Manager (dashboard + Inventory page).
 * Mirrors dealer thresholds, low coverage, regions under min, and roll-up negatives.
 */
export async function fetchInventoryStockAlerts(supabase: SupabaseClient): Promise<{
  alerts: InventoryStockAlert[]
  summary: InventoryStockSummary
  consumption30ByKey: Record<string, number>
  overallByModel: Record<string, number>
  thresholds: { dealer_id: string; camera_model_id: string; min_qty: number }[]
}> {
  const since = subDays(new Date(), 30).toISOString()

  const [dealersRes, camerasRes, balancesRes, thresholdsRes, consumptionRes] = await Promise.all([
    supabase
      .from('dealers')
      .select('id, name, region_code_id, region_codes(code, name)')
      .order('name'),
    supabase.from('camera_models').select('id, name, stock_quantity').order('name'),
    supabase.from('dealer_inventory_balances').select('dealer_id, camera_model_id, quantity'),
    supabase.from('dealer_inventory_thresholds').select('dealer_id, camera_model_id, min_qty'),
    supabase
      .from('inventory_movements')
      .select('dealer_id, camera_model_id')
      .eq('movement_type', 'consumption')
      .gte('created_at', since),
  ])

  type DealerRow = {
    id: string
    name: string
    region_code_id: string | null
    region_codes: { code: string; name: string } | null
  }
  type CameraRow = { id: string; name: string; stock_quantity: number | null }
  type BalanceRow = { dealer_id: string; camera_model_id: string; quantity: string | number | null }
  type ThresholdRow = { dealer_id: string; camera_model_id: string; min_qty: number }

  const dealers = (dealersRes.data ?? []) as unknown as DealerRow[]
  const cameras = (camerasRes.data ?? []) as CameraRow[]
  const balances = (balancesRes.data ?? []) as BalanceRow[]
  const thresholds = (thresholdsRes.data ?? []) as ThresholdRow[]

  const consumption30ByKey: Record<string, number> = {}
  for (const row of consumptionRes.data ?? []) {
    const k = consumptionKey(
      (row as { dealer_id: string }).dealer_id,
      (row as { camera_model_id: string }).camera_model_id
    )
    consumption30ByKey[k] = (consumption30ByKey[k] ?? 0) + 1
  }

  const dealerById = new Map(dealers.map((d) => [d.id, d]))
  const cameraById = new Map(cameras.map((c) => [c.id, c]))
  const qtyByDealerModel = new Map<string, number>()
  for (const b of balances) {
    const q = typeof b.quantity === 'string' ? parseInt(b.quantity, 10) : Number(b.quantity ?? 0)
    qtyByDealerModel.set(consumptionKey(b.dealer_id, b.camera_model_id), Number.isFinite(q) ? q : 0)
  }

  let shortSkuLines = 0
  for (const q of qtyByDealerModel.values()) {
    if (q < 0) shortSkuLines += 1
  }

  const overallByModel = new Map<string, number>()
  for (const [key, q] of qtyByDealerModel) {
    const modelId = key.split(':')[1]
    if (!modelId) continue
    overallByModel.set(modelId, (overallByModel.get(modelId) ?? 0) + q)
  }

  let negModelRollups = 0
  for (const q of overallByModel.values()) {
    if (q < 0) negModelRollups += 1
  }

  let belowMinLines = 0
  for (const t of thresholds) {
    const key = consumptionKey(t.dealer_id, t.camera_model_id)
    const qty = qtyByDealerModel.get(key) ?? 0
    if (qty < t.min_qty) belowMinLines += 1
  }

  let dealerQtyTotal = 0
  for (const q of qtyByDealerModel.values()) {
    dealerQtyTotal += q
  }

  const alerts: InventoryStockAlert[] = []

  if (shortSkuLines > 0) {
    alerts.push({
      level: 'warning',
      title: `General stock warning: ${shortSkuLines} row(s) negative`,
      detail:
        'On-hand by dealer × model is below zero. Demand consumption may have exceeded recorded receipts. Post stock via Inventory → Receipt / adjust or By dealer.',
    })
  }

  if (negModelRollups > 0) {
    alerts.push({
      level: 'warning',
      title: `${negModelRollups} camera model(s) with negative dealer total`,
      detail:
        'Field stock is short when summed across all dealers for those models. Do not confuse with Catalog (HQ); correct via inventory movements in the field.',
    })
  }

  if (dealerQtyTotal < 0) {
    alerts.push({
      level: 'warning',
      title: 'Dealer stock is net negative system-wide',
      detail: `Sum of all rows is ${dealerQtyTotal}. Open the Inventory page for the full summary and detail.`,
    })
  }

  for (const t of thresholds) {
    const key = consumptionKey(t.dealer_id, t.camera_model_id)
    const qty = qtyByDealerModel.get(key) ?? 0
    const dealer = dealerById.get(t.dealer_id)
    const cam = cameraById.get(t.camera_model_id)
    if (qty < t.min_qty) {
      alerts.push({
        level: 'warning',
        title: `Below minimum — ${dealer?.name ?? 'Dealer'}`,
        detail: `${cam?.name ?? 'Camera'}: on hand ${qty}, min ${t.min_qty}.`,
      })
    }
  }

  for (const b of balances) {
    const key = consumptionKey(b.dealer_id, b.camera_model_id)
    const qty = qtyByDealerModel.get(key) ?? 0
    if (qty <= 0) continue
    const cons = consumption30ByKey[key] ?? 0
    const dailyAvg = cons / 30
    if (dailyAvg < 0.05) continue
    const daysCover = qty / dailyAvg
    if (daysCover < 7) {
      const dealer = dealerById.get(b.dealer_id)
      const cam = cameraById.get(b.camera_model_id)
      alerts.push({
        level: 'info',
        title: `Low stock coverage — ${dealer?.name ?? 'Dealer'}`,
        detail: `${cam?.name ?? 'Camera'}: ~${daysCover.toFixed(1)} days (${cons} installs / 30d, ${qty} on hand).`,
      })
    }
  }

  const regionLow: Record<string, number> = {}
  for (const t of thresholds) {
    const key = consumptionKey(t.dealer_id, t.camera_model_id)
    const qty = qtyByDealerModel.get(key) ?? 0
    if (qty >= t.min_qty) continue
    const d = dealerById.get(t.dealer_id)
    const rid = d?.region_codes?.code ?? '—'
    regionLow[rid] = (regionLow[rid] ?? 0) + 1
  }
  for (const [code, count] of Object.entries(regionLow)) {
    if (count > 0) {
      alerts.push({
        level: 'info',
        title: `Region ${code}`,
        detail: `${count} dealer/model combination(s) below the configured minimum.`,
      })
    }
  }

  const warningCount = alerts.filter((a) => a.level === 'warning').length
  const infoCount = alerts.filter((a) => a.level === 'info').length

  return {
    alerts,
    summary: {
      shortSkuLines,
      belowMinLines,
      negModelRollups,
      dealerQtyTotal,
      catalogModelCount: cameras.length,
      warningCount,
      infoCount,
    },
    consumption30ByKey,
    overallByModel: Object.fromEntries(overallByModel),
    thresholds,
  }
}
