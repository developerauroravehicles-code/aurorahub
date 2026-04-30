'use client'

import { useMemo, useState, useEffect, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { subDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { addManualInventoryMovement, upsertInventoryThreshold, resetInventoryStockData } from './actions'
import { createCameraModel, updateCameraStock } from '@/app/dashboard/system-management/actions'
import {
  Package,
  Warehouse,
  TrendingDown,
  Activity,
  AlertTriangle,
  Download,
  Filter,
  BarChart3,
  ClipboardList,
  Loader2,
} from 'lucide-react'
import { SYSTEM_DEFAULT_TIMEZONE, formatInPT } from '@/lib/timezone-defaults'

type DealerRow = {
  id: string
  name: string
  region_code_id: string | null
  region_codes: { code: string; name: string } | null
}

type CameraRow = { id: string; name: string; stock_quantity: number | null }

type BalanceRow = { dealer_id: string; camera_model_id: string; quantity: number }

type MovementRow = {
  id: string
  dealer_id: string
  camera_model_id: string
  quantity_delta: number
  movement_type: string
  note: string | null
  created_at: string
  reference_demand_id: string | null
  dealers: { name: string } | null
  camera_models: { name: string } | null
}

type ThresholdRow = { dealer_id: string; camera_model_id: string; min_qty: number }

type Suggestion = { title: string; detail: string; level: 'info' | 'warning' }

const MOV_TYPE_COLOR: Record<string, string> = {
  consumption: '#f87171',
  receipt: '#4ade80',
  adjustment: '#fbbf24',
  return_to_hq: '#a78bfa',
}

function movementTypeDisplay(type: string): string {
  switch (type) {
    case 'consumption':
      return 'Consumption'
    case 'receipt':
      return 'Receipt'
    case 'adjustment':
      return 'Adjustment'
    case 'return_to_hq':
      return 'Return to HQ'
    default:
      return type || 'Other'
  }
}

type DealerTableRow = BalanceRow & {
  d: DealerRow | undefined
  c: CameraRow | undefined
  k: string
  cons: number
  t: ThresholdRow | undefined
  belowMin: boolean
  negative: boolean
  status: 'negative' | 'below_min' | 'ok'
}

const DEALER_STATUS_ORDER: Record<DealerTableRow['status'], number> = { negative: 0, below_min: 1, ok: 2 }

function dealerStatusLabel(s: DealerTableRow['status']) {
  switch (s) {
    case 'negative':
      return 'Short'
    case 'below_min':
      return 'Below min'
    default:
      return 'OK'
  }
}

type RegionAggRow = {
  code: string
  name: string
  units: number
  dealers: Set<string>
  consumption30: number
  stockRowCount: number
  shortSkus: number
  belowMinSkus: number
}

type RegionRowStatus = 'critical' | 'below_min' | 'ok'

const REGION_ROW_STATUS_ORDER: Record<RegionRowStatus, number> = { critical: 0, below_min: 1, ok: 2 }

function regionRowStatus(r: RegionAggRow): RegionRowStatus {
  if (r.shortSkus > 0 || r.units < 0) return 'critical'
  if (r.belowMinSkus > 0) return 'below_min'
  return 'ok'
}

function regionStatusLabel(s: RegionRowStatus) {
  switch (s) {
    case 'critical':
      return 'Action needed'
    case 'below_min':
      return 'Below min'
    default:
      return 'OK'
  }
}

type RegionSortKey =
  | 'code'
  | 'name'
  | 'dealers'
  | 'rows'
  | 'units'
  | 'consumption'
  | 'short'
  | 'belowMin'
  | 'status'

type Props = {
  dealers: DealerRow[]
  cameras: CameraRow[]
  balances: BalanceRow[]
  movements: MovementRow[]
  thresholds: ThresholdRow[]
  consumption30ByKey: Record<string, number>
  suggestions: Suggestion[]
  overallByModel: Record<string, number>
}

export function InventoryDashboard({
  dealers,
  cameras,
  balances,
  movements,
  thresholds,
  consumption30ByKey,
  suggestions,
  overallByModel,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'overview' | 'dealers' | 'regions' | 'movements' | 'manual'>('overview')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [hqSavingId, setHqSavingId] = useState<string | null>(null)
  const [camCreateState, createCamAction, createCamPending] = useActionState(createCameraModel, null)

  const [dealerFilterId, setDealerFilterId] = useState('')
  const [regionFilterCode, setRegionFilterCode] = useState('')
  const [cameraFilterId, setCameraFilterId] = useState('')
  const [issuesOnly, setIssuesOnly] = useState(false)
  const [sortKey, setSortKey] = useState<
    'dealer' | 'camera' | 'qty' | 'region' | 'installs' | 'min' | 'status'
  >('dealer')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [movDealerId, setMovDealerId] = useState('')
  const [movCameraId, setMovCameraId] = useState('')
  const [movMovementType, setMovMovementType] = useState('receipt')
  const [movQty, setMovQty] = useState('')
  const [movNote, setMovNote] = useState('')
  const [thrDealerId, setThrDealerId] = useState('')
  const [thrCameraId, setThrCameraId] = useState('')
  const [thrMinQty, setThrMinQty] = useState<string>('')

  const [receiptJump, setReceiptJump] = useState<{ dealer_id: string; camera_model_id: string } | null>(null)
  const [thresholdJump, setThresholdJump] = useState<{
    dealer_id: string
    camera_model_id: string
    min_qty?: number
  } | null>(null)

  const [movFilterDealer, setMovFilterDealer] = useState('')
  const [movFilterType, setMovFilterType] = useState('')
  const [movDaysPreset, setMovDaysPreset] = useState<'7' | '30' | '90' | 'all'>('30')

  const [regionSearch, setRegionSearch] = useState('')
  const [regionIssuesOnly, setRegionIssuesOnly] = useState(false)
  const [regionSortKey, setRegionSortKey] = useState<RegionSortKey>('code')
  const [regionSortDir, setRegionSortDir] = useState<'asc' | 'desc'>('asc')

  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetPending, setResetPending] = useState(false)

  useEffect(() => {
    if (!camCreateState) return
    if (camCreateState.success) {
      setMsg({ type: 'ok', text: camCreateState.success })
      router.refresh()
      ;(document.getElementById('inv-new-camera-form') as HTMLFormElement | null)?.reset()
    }
    if (camCreateState.error) setMsg({ type: 'err', text: camCreateState.error })
  }, [camCreateState, router])

  useEffect(() => {
    if (tab !== 'manual') return
    if (receiptJump) {
      setMovDealerId(receiptJump.dealer_id)
      setMovCameraId(receiptJump.camera_model_id)
      setMovMovementType('receipt')
      setReceiptJump(null)
    }
  }, [tab, receiptJump])

  useEffect(() => {
    if (tab !== 'manual') return
    if (thresholdJump) {
      setThrDealerId(thresholdJump.dealer_id)
      setThrCameraId(thresholdJump.camera_model_id)
      setThrMinQty(thresholdJump.min_qty != null ? String(thresholdJump.min_qty) : '2')
      setThresholdJump(null)
    }
  }, [tab, thresholdJump])

  async function saveHqStock(cameraId: string) {
    const el = document.getElementById(`hq-stock-${cameraId}`) as HTMLInputElement | null
    if (!el) return
    const v = Math.max(0, parseInt(el.value, 10) || 0)
    setHqSavingId(cameraId)
    setMsg(null)
    const r = await updateCameraStock(cameraId, v)
    setHqSavingId(null)
    if (r.error) setMsg({ type: 'err', text: r.error })
    else {
      setMsg({ type: 'ok', text: 'HQ stock updated.' })
      router.refresh()
    }
  }

  const dealerById = useMemo(() => new Map(dealers.map((d) => [d.id, d])), [dealers])
  const cameraById = useMemo(() => new Map(cameras.map((c) => [c.id, c])), [cameras])

  const regionsList = useMemo(() => {
    const s = new Set<string>()
    dealers.forEach((d) => s.add(d.region_codes?.code ?? '—'))
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [dealers])

  const dealerTableRows: DealerTableRow[] = useMemo(() => {
    return balances.map((b) => {
      const d = dealerById.get(b.dealer_id)
      const c = cameraById.get(b.camera_model_id)
      const k = `${b.dealer_id}:${b.camera_model_id}`
      const t = thresholds.find((x) => x.dealer_id === b.dealer_id && x.camera_model_id === b.camera_model_id)
      const cons = consumption30ByKey[k] ?? 0
      const belowMin = t != null && b.quantity < t.min_qty
      const negative = b.quantity < 0
      const status: DealerTableRow['status'] = negative ? 'negative' : belowMin ? 'below_min' : 'ok'
      return { ...b, d, c, k, t, cons, belowMin, negative, status }
    })
  }, [balances, dealerById, cameraById, thresholds, consumption30ByKey])

  const overviewHqAnalytics = useMemo(() => {
    const shortSkuCount = dealerTableRows.filter((r) => r.negative).length
    const belowMinSku = dealerTableRows.filter((r) => r.belowMin).length

    const modelRows = cameras.map((c) => {
      const hq = c.stock_quantity ?? 0
      const dealers = overallByModel[c.id] ?? 0
      const shortLabel = c.name.length > 22 ? `${c.name.slice(0, 20)}…` : c.name
      return { id: c.id, name: c.name, shortLabel, hq, dealers, notional: hq + dealers }
    })

    const totalHq = modelRows.reduce((s, r) => s + r.hq, 0)
    const totalDealers = modelRows.reduce((s, r) => s + r.dealers, 0)
    const negModels = modelRows.filter((r) => r.dealers < 0).length
    const notionalTotal = totalHq + totalDealers

    const pieData = modelRows
      .filter((r) => r.dealers > 0)
      .map((r, i) => ({
        name: r.shortLabel,
        value: r.dealers,
        fill: ['#C27E00', '#3b82f6', '#22c55e', '#a78bfa', '#ec4899', '#14b8a6'][i % 6],
      }))

    return {
      modelRows,
      totalHq,
      totalDealers,
      negModels,
      notionalTotal,
      pieData,
      shortSkuCount,
      belowMinSku,
    }
  }, [cameras, overallByModel, dealerTableRows])

  const overviewInsights = useMemo((): Suggestion[] => {
    const out: Suggestion[] = []
    const a = overviewHqAnalytics
    if (a.modelRows.length === 0) {
      out.push({
        level: 'info',
        title: 'No catalog models',
        detail: 'Add a camera model below or in Platform Management to track HQ reference and dealer inventory.',
      })
      return out
    }
    if (a.shortSkuCount > 0) {
      out.push({
        level: 'warning',
        title: `${a.shortSkuCount} dealer SKU line(s) below zero`,
        detail:
          'HQ totals do not auto-flow to dealers. Use Receipt / adjust or By dealer row actions to post stock in.',
      })
    }
    if (a.totalDealers < 0) {
      out.push({
        level: 'warning',
        title: 'Dealer rollups are net negative',
        detail: `Sum of “all dealers on hand” across models is ${a.totalDealers}. That reflects demand/movements without enough recorded receipts.`,
      })
    }
    if (a.negModels > 0) {
      const worst = [...a.modelRows].sort((x, y) => x.dealers - y.dealers)[0]
      out.push({
        level: 'warning',
        title: `${a.negModels} model(s) with negative field total`,
        detail: worst
          ? `Lowest: ${worst.name} at ${worst.dealers} units across dealers. Filter By dealer by camera to fix lines.`
          : '',
      })
    }
    if (a.belowMinSku > 0) {
      out.push({
        level: 'info',
        title: `${a.belowMinSku} line(s) below configured minimum`,
        detail: 'Set or adjust thresholds under Receipt / adjust; warnings also appear in Suggestions when applicable.',
      })
    }
    if (out.length === 0) {
      out.push({
        level: 'info',
        title: 'No roll-up issues on this snapshot',
        detail:
          'Model-level dealer totals are non-negative and no SKU lines are short. Add mins for proactive alerts.',
      })
    }
    return out
  }, [overviewHqAnalytics])

  const filteredDealerRows = useMemo(() => {
    return dealerTableRows.filter((r) => {
      if (dealerFilterId && r.dealer_id !== dealerFilterId) return false
      if (regionFilterCode && (r.d?.region_codes?.code ?? '—') !== regionFilterCode) return false
      if (cameraFilterId && r.camera_model_id !== cameraFilterId) return false
      if (issuesOnly && r.status === 'ok') return false
      return true
    })
  }, [dealerTableRows, dealerFilterId, regionFilterCode, cameraFilterId, issuesOnly])

  const sortedDealerRows = useMemo(() => {
    const arr = [...filteredDealerRows]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'qty':
          return dir * (a.quantity - b.quantity)
        case 'installs':
          return dir * (a.cons - b.cons)
        case 'region':
          return dir * String(a.d?.region_codes?.code ?? '').localeCompare(String(b.d?.region_codes?.code ?? ''))
        case 'camera':
          return dir * String(a.c?.name ?? '').localeCompare(String(b.c?.name ?? ''))
        case 'min': {
          const va = a.t?.min_qty
          const vb = b.t?.min_qty
          if (va == null && vb == null) return 0
          if (va == null) return dir
          if (vb == null) return -dir
          return dir * (va - vb)
        }
        case 'status':
          return dir * (DEALER_STATUS_ORDER[a.status] - DEALER_STATUS_ORDER[b.status])
        case 'dealer':
        default:
          return dir * String(a.d?.name ?? '').localeCompare(String(b.d?.name ?? ''))
      }
    })
    return arr
  }, [filteredDealerRows, sortKey, sortDir])

  const dealerKpis = useMemo(() => {
    const neg = filteredDealerRows.filter((r) => r.negative).length
    const below = filteredDealerRows.filter((r) => r.belowMin && !r.negative).length
    const installs = filteredDealerRows.reduce((s, r) => s + r.cons, 0)
    return { neg, below, installs, rows: filteredDealerRows.length }
  }, [filteredDealerRows])

  const filteredMovements = useMemo(() => {
    const cutoff =
      movDaysPreset === 'all'
        ? null
        : subDays(new Date(), movDaysPreset === '7' ? 7 : movDaysPreset === '30' ? 30 : 90)
    return movements.filter((m) => {
      if (cutoff && new Date(m.created_at) < cutoff) return false
      if (movFilterDealer && m.dealer_id !== movFilterDealer) return false
      if (movFilterType && m.movement_type !== movFilterType) return false
      return true
    })
  }, [movements, movFilterDealer, movFilterType, movDaysPreset])

  const movementAnalytics = useMemo(() => {
    const tz = SYSTEM_DEFAULT_TIMEZONE
    type DayBucket = {
      dayKey: string
      dayLabel: string
      consumption: number
      receipt: number
      adjustment: number
      return_hq: number
      other: number
    }
    const dayMap = new Map<string, DayBucket>()
    const ensureDay = (dayKey: string) => {
      if (!dayMap.has(dayKey)) {
        const [, mo, d] = dayKey.split('-')
        dayMap.set(dayKey, {
          dayKey,
          dayLabel: mo && d ? `${mo}/${d}` : dayKey,
          consumption: 0,
          receipt: 0,
          adjustment: 0,
          return_hq: 0,
          other: 0,
        })
      }
      return dayMap.get(dayKey)!
    }

    let net = 0
    let consumptionCount = 0
    let receiptCount = 0
    let minT: number | null = null
    let maxT: number | null = null
    const typeAgg = new Map<string, number>()
    const byDealer = new Map<
      string,
      { name: string; n: number; net: number; consumption: number }
    >()
    const byCamera = new Map<
      string,
      { name: string; n: number; net: number; consumption: number }
    >()

    for (const m of filteredMovements) {
      net += m.quantity_delta
      const t = new Date(m.created_at).getTime()
      if (minT == null || t < minT) minT = t
      if (maxT == null || t > maxT) maxT = t

      const dk = formatInTimeZone(new Date(m.created_at), tz, 'yyyy-MM-dd')
      const b = ensureDay(dk)
      const mt = m.movement_type
      if (mt === 'consumption') {
        b.consumption += 1
        consumptionCount += 1
      } else if (mt === 'receipt') {
        b.receipt += 1
        receiptCount += 1
      } else if (mt === 'adjustment') {
        b.adjustment += 1
      } else if (mt === 'return_to_hq') {
        b.return_hq += 1
      } else {
        b.other += 1
      }

      typeAgg.set(mt, (typeAgg.get(mt) ?? 0) + 1)

      const dn = m.dealers?.name ?? '—'
      const dRow = byDealer.get(m.dealer_id) ?? { name: dn, n: 0, net: 0, consumption: 0 }
      dRow.n += 1
      dRow.net += m.quantity_delta
      if (mt === 'consumption') dRow.consumption += 1
      byDealer.set(m.dealer_id, dRow)

      const cn = m.camera_models?.name ?? '—'
      const cRow = byCamera.get(m.camera_model_id) ?? { name: cn, n: 0, net: 0, consumption: 0 }
      cRow.n += 1
      cRow.net += m.quantity_delta
      if (mt === 'consumption') cRow.consumption += 1
      byCamera.set(m.camera_model_id, cRow)
    }

    const daily = [...dayMap.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey))
    const byType = [...typeAgg.entries()]
      .map(([raw, value]) => ({
        name: movementTypeDisplay(raw),
        raw,
        value,
        fill: MOV_TYPE_COLOR[raw] ?? '#9ca3af',
      }))
      .sort((a, b) => b.value - a.value)

    const dealerBars = [...byDealer.entries()]
      .map(([id, v]) => ({ id, ...v, label: v.name.length > 22 ? `${v.name.slice(0, 20)}…` : v.name }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10)

    const cameraBars = [...byCamera.entries()]
      .map(([id, v]) => ({
        id,
        ...v,
        label: v.name.length > 24 ? `${v.name.slice(0, 22)}…` : v.name,
      }))
      .sort((a, b) => b.consumption - a.consumption)
      .slice(0, 10)

    return {
      daily,
      byType,
      dealerBars,
      cameraBars,
      netDeltaSum: net,
      consumptionCount,
      receiptCount,
      eventCount: filteredMovements.length,
      dateMin: minT != null ? formatInPT(new Date(minT), 'dd.MM.yyyy') : null,
      dateMax: maxT != null ? formatInPT(new Date(maxT), 'dd.MM.yyyy') : null,
    }
  }, [filteredMovements])

  const movementInsights = useMemo((): Suggestion[] => {
    const out: Suggestion[] = []
    const n = filteredMovements.length
    if (n === 0) return out

    const net = filteredMovements.reduce((s, m) => s + m.quantity_delta, 0)
    if (net <= -10) {
      out.push({
        level: 'warning',
        title: 'Large net drawdown in this view',
        detail: `Sum of quantity deltas is ${net}. Cross-check By dealer for short SKUs and post receipts where needed.`,
      })
    }

    const consByDealer = new Map<string, { name: string; cnt: number }>()
    for (const m of filteredMovements) {
      if (m.movement_type !== 'consumption') continue
      const cur = consByDealer.get(m.dealer_id) ?? { name: m.dealers?.name ?? 'Dealer', cnt: 0 }
      cur.cnt += 1
      consByDealer.set(m.dealer_id, cur)
    }
    let top: { id: string; name: string; cnt: number } | null = null
    for (const [id, v] of consByDealer) {
      if (!top || v.cnt > top.cnt) top = { id, name: v.name, cnt: v.cnt }
    }
    if (top && top.cnt > 0) {
      const negSku = dealerTableRows.filter((r) => r.dealer_id === top.id && r.negative)
      if (negSku.length > 0) {
        out.push({
          level: 'warning',
          title: `Heavy consumption at ${top.name}`,
          detail: `${top.cnt} consumption event(s) in this window while ${negSku.length} SKU line(s) are still below zero.`,
        })
      }
    }

    const pairMap = new Map<string, { dealerId: string; cameraId: string; dealer: string; camera: string; cnt: number }>()
    for (const m of filteredMovements) {
      if (m.movement_type !== 'consumption') continue
      const k = `${m.dealer_id}:${m.camera_model_id}`
      const cur = pairMap.get(k) ?? {
        dealerId: m.dealer_id,
        cameraId: m.camera_model_id,
        dealer: m.dealers?.name ?? '—',
        camera: m.camera_models?.name ?? '—',
        cnt: 0,
      }
      cur.cnt += 1
      pairMap.set(k, cur)
    }
    let topPair: {
      dealerId: string
      cameraId: string
      dealer: string
      camera: string
      cnt: number
    } | null = null
    for (const p of pairMap.values()) {
      if (!topPair || p.cnt > topPair.cnt) topPair = p
    }
    if (topPair && topPair.cnt >= 3) {
      const row = dealerTableRows.find(
        (r) => r.dealer_id === topPair!.dealerId && r.camera_model_id === topPair!.cameraId
      )
      if (row?.negative) {
        out.push({
          level: 'warning',
          title: `Hot SKU: ${topPair.camera} @ ${topPair.dealer}`,
          detail: `${topPair.cnt} consumption(s) here in this window; on hand is ${row.quantity}. Consider a targeted receipt.`,
        })
      }
    }

    const byDay = new Map<string, number>()
    for (const m of filteredMovements) {
      const dk = formatInTimeZone(new Date(m.created_at), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
      byDay.set(dk, (byDay.get(dk) ?? 0) + 1)
    }
    const counts = [...byDay.values()]
    if (counts.length >= 3) {
      const max = Math.max(...counts)
      const sum = counts.reduce((a, b) => a + b, 0)
      const avg = sum / counts.length
      const maxEntry = [...byDay.entries()].find(([, c]) => c === max)
      if (maxEntry && max >= 5 && max > avg * 2) {
        const [y, mo, d] = maxEntry[0].split('-')
        out.push({
          level: 'info',
          title: 'Activity spike',
          detail: `${max} events on ${d}.${mo}.${y} (~${avg.toFixed(1)} avg/day in this window).`,
        })
      }
    }

    const consN = filteredMovements.filter((m) => m.movement_type === 'consumption').length
    if (n >= 15 && consN / n > 0.92) {
      out.push({
        level: 'info',
        title: 'Consumption-heavy log',
        detail:
          'Most rows are demand-driven consumption. Receipts appear as separate movement types — use Receipt / adjust when stock goes short.',
      })
    }

    return out
  }, [filteredMovements, dealerTableRows])

  const manualWorkspaceAnalytics = useMemo(() => {
    const tz = SYSTEM_DEFAULT_TIMEZONE
    const balanceRowsCount = dealerTableRows.length
    const withThr = dealerTableRows.filter((r) => r.t != null).length
    const shortCount = dealerTableRows.filter((r) => r.negative).length
    const belowMinCount = dealerTableRows.filter((r) => r.belowMin).length

    const shortBar = [...dealerTableRows]
      .filter((r) => r.negative)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 10)
      .map((r) => {
        const dn = r.d?.name ?? '—'
        const cn = r.c?.name ?? '—'
        const dl = dn.length > 16 ? `${dn.slice(0, 14)}…` : dn
        const cl = cn.length > 18 ? `${cn.slice(0, 16)}…` : cn
        return { label: `${dl} · ${cl}`, qty: r.quantity, k: r.k }
      })

    const isManualType = (mt: string) =>
      mt === 'receipt' || mt === 'return_to_hq' || mt === 'adjustment'

    const cutoff14 = subDays(new Date(), 14)
    const cutoff30 = subDays(new Date(), 30)

    type DayM = {
      dayKey: string
      dayLabel: string
      receipt: number
      return_hq: number
      adjustment: number
    }
    const dayMap = new Map<string, DayM>()
    const ensureDay = (dayKey: string) => {
      if (!dayMap.has(dayKey)) {
        const [, mo, d] = dayKey.split('-')
        dayMap.set(dayKey, {
          dayKey,
          dayLabel: mo && d ? `${mo}/${d}` : dayKey,
          receipt: 0,
          return_hq: 0,
          adjustment: 0,
        })
      }
      return dayMap.get(dayKey)!
    }

    let receipts30 = 0
    let adjustments30 = 0
    let returns30 = 0
    const dealerManualNet = new Map<string, { name: string; net: number }>()

    for (const m of movements) {
      if (!isManualType(m.movement_type)) continue
      const created = new Date(m.created_at)
      if (created >= cutoff30) {
        if (m.movement_type === 'receipt') receipts30 += 1
        else if (m.movement_type === 'adjustment') adjustments30 += 1
        else if (m.movement_type === 'return_to_hq') returns30 += 1

        const nm = m.dealers?.name ?? '—'
        const dr = dealerManualNet.get(m.dealer_id) ?? { name: nm, net: 0 }
        dr.net += m.quantity_delta
        dealerManualNet.set(m.dealer_id, dr)
      }
      if (created < cutoff14) continue
      const dk = formatInTimeZone(created, tz, 'yyyy-MM-dd')
      const b = ensureDay(dk)
      if (m.movement_type === 'receipt') b.receipt += 1
      else if (m.movement_type === 'return_to_hq') b.return_hq += 1
      else if (m.movement_type === 'adjustment') b.adjustment += 1
    }

    const manualDaily = [...dayMap.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey))

    const dealerNetBars = [...dealerManualNet.entries()]
      .map(([, v]) => ({
        ...v,
        label: v.name.length > 22 ? `${v.name.slice(0, 20)}…` : v.name,
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 8)

    const thresholdPie =
      balanceRowsCount === 0
        ? []
        : [
            { name: 'Has min threshold', value: withThr, fill: '#C27E00' },
            {
              name: 'No threshold',
              value: Math.max(0, balanceRowsCount - withThr),
              fill: '#4b5563',
            },
          ].filter((x) => x.value > 0)

    const coveragePct =
      balanceRowsCount > 0 ? Math.round((withThr / balanceRowsCount) * 100) : 0

    return {
      shortBar,
      manualDaily,
      balanceRowsCount,
      withThr,
      shortCount,
      belowMinCount,
      receipts30,
      adjustments30,
      returns30,
      dealerNetBars,
      thresholdPie,
      coveragePct,
    }
  }, [dealerTableRows, movements])

  const manualInsights = useMemo((): Suggestion[] => {
    const out: Suggestion[] = []
    const rows = dealerTableRows
    if (rows.length === 0) {
      out.push({
        level: 'info',
        title: 'No dealer stock rows yet',
        detail:
          'Balances appear after the first movements. Completed demands record consumption when the camera maps to the catalog.',
      })
      return out
    }
    const short = rows.filter((r) => r.negative).length
    if (short > 0) {
      out.push({
        level: 'warning',
        title: `${short} SKU line(s) below zero`,
        detail:
          'Prioritize receipts for those pairs. Use Worst on-hand below, or By dealer for row actions (Receipt / Set min).',
      })
    }
    const below = rows.filter((r) => r.belowMin && !r.negative).length
    if (below > 0) {
      out.push({
        level: 'info',
        title: `${below} row(s) below configured minimum`,
        detail:
          'Shown in Overview suggestions. Add stock or revisit the minimum if targets changed.',
      })
    }
    const noThr = rows.filter((r) => !r.t).length
    const coveragePct = rows.length > 0 ? Math.round(((rows.length - noThr) / rows.length) * 100) : 0
    if (noThr > 0 && coveragePct < 80) {
      out.push({
        level: 'info',
        title: 'Threshold coverage',
        detail: `${noThr} stock row(s) have no minimum (${coveragePct}% covered). Adding mins improves Suggestions.`,
      })
    }
    if (rows.length > 0 && short === 0 && below === 0 && noThr === 0) {
      out.push({
        level: 'info',
        title: 'All lines in OK range',
        detail: 'No negatives, no below-min flags, and every row has a threshold. Keep logging receipts as installs happen.',
      })
    }
    return out
  }, [dealerTableRows])

  const movementTypes = useMemo(() => {
    const s = new Set(movements.map((m) => m.movement_type))
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [movements])

  function toggleSort(next: typeof sortKey) {
    if (sortKey === next) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(next)
      setSortDir('asc')
    }
  }

  function sortHeader(label: string, key: typeof sortKey) {
    const active = sortKey === key
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-1 font-medium uppercase tracking-wider hover:text-zinc-900 dark:text-white ${
          active ? 'text-[#C27E00]' : ''
        }`}
      >
        {label}
        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    )
  }

  function downloadDealerCsv() {
    const esc = (v: string | number) => {
      const s = String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const headers = ['Dealer', 'Region', 'Camera', 'On hand', '30d installs', 'Min', 'Status']
    const lines = [
      headers.join(','),
      ...sortedDealerRows.map((r) =>
        [
          esc(r.d?.name ?? ''),
          esc(r.d?.region_codes?.code ?? '—'),
          esc(r.c?.name ?? ''),
          r.quantity,
          r.cons,
          r.t?.min_qty ?? '',
          dealerStatusLabel(r.status),
        ].join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `inventory-by-dealer-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function downloadOverviewCsv() {
    const esc = (v: string | number) => {
      const s = String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const headers = ['Model', 'HQ total', 'All dealers on hand', 'Notional HQ+dealers']
    const lines = [
      headers.join(','),
      ...overviewHqAnalytics.modelRows.map((r) =>
        [esc(r.name), r.hq, r.dealers, r.notional].join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `inventory-hq-catalog-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const regionTableRows = useMemo((): RegionAggRow[] => {
    const m = new Map<string, RegionAggRow>()
    for (const b of balances) {
      const d = dealerById.get(b.dealer_id)
      const code = d?.region_codes?.code ?? '—'
      const name = d?.region_codes?.name ?? 'Unassigned'
      if (!m.has(code)) {
        m.set(code, {
          code,
          name,
          units: 0,
          dealers: new Set(),
          consumption30: 0,
          stockRowCount: 0,
          shortSkus: 0,
          belowMinSkus: 0,
        })
      }
      const row = m.get(code)!
      row.units += b.quantity
      row.dealers.add(b.dealer_id)
      row.stockRowCount += 1
    }
    for (const [k, cnt] of Object.entries(consumption30ByKey)) {
      const [dealerId] = k.split(':')
      const d = dealerById.get(dealerId)
      const code = d?.region_codes?.code ?? '—'
      const rname = d?.region_codes?.name ?? 'Unassigned'
      if (!m.has(code)) {
        m.set(code, {
          code,
          name: rname,
          units: 0,
          dealers: new Set(),
          consumption30: 0,
          stockRowCount: 0,
          shortSkus: 0,
          belowMinSkus: 0,
        })
      }
      m.get(code)!.consumption30 += cnt
    }
    for (const r of dealerTableRows) {
      const code = r.d?.region_codes?.code ?? '—'
      const row = m.get(code)
      if (!row) continue
      if (r.negative) row.shortSkus += 1
      else if (r.belowMin) row.belowMinSkus += 1
    }
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code))
  }, [balances, dealerById, consumption30ByKey, dealerTableRows])

  const filteredRegionRows = useMemo(() => {
    const q = regionSearch.trim().toLowerCase()
    return regionTableRows.filter((r) => {
      if (regionIssuesOnly) {
        const st = regionRowStatus(r)
        if (st === 'ok') return false
      }
      if (!q) return true
      return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    })
  }, [regionTableRows, regionSearch, regionIssuesOnly])

  const sortedRegionRows = useMemo(() => {
    const arr = [...filteredRegionRows]
    const dir = regionSortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      switch (regionSortKey) {
        case 'dealers':
          return dir * (a.dealers.size - b.dealers.size)
        case 'rows':
          return dir * (a.stockRowCount - b.stockRowCount)
        case 'units':
          return dir * (a.units - b.units)
        case 'consumption':
          return dir * (a.consumption30 - b.consumption30)
        case 'short':
          return dir * (a.shortSkus - b.shortSkus)
        case 'belowMin':
          return dir * (a.belowMinSkus - b.belowMinSkus)
        case 'status':
          return (
            dir *
            (REGION_ROW_STATUS_ORDER[regionRowStatus(a)] - REGION_ROW_STATUS_ORDER[regionRowStatus(b)])
          )
        case 'name':
          return dir * a.name.localeCompare(b.name)
        case 'code':
        default:
          return dir * a.code.localeCompare(b.code)
      }
    })
    return arr
  }, [filteredRegionRows, regionSortKey, regionSortDir])

  const regionKpis = useMemo(() => {
    let critical = 0
    let below = 0
    let shortSkus = 0
    for (const r of filteredRegionRows) {
      const st = regionRowStatus(r)
      if (st === 'critical') critical++
      else if (st === 'below_min') below++
      shortSkus += r.shortSkus
    }
    return { critical, below, shortSkus, rows: filteredRegionRows.length }
  }, [filteredRegionRows])

  function toggleRegionSort(next: RegionSortKey) {
    if (regionSortKey === next) {
      setRegionSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setRegionSortKey(next)
      setRegionSortDir('asc')
    }
  }

  function regionSortHeader(label: string, key: RegionSortKey) {
    const active = regionSortKey === key
    return (
      <button
        type="button"
        onClick={() => toggleRegionSort(key)}
        className={`inline-flex items-center gap-1 font-medium uppercase tracking-wider hover:text-zinc-900 dark:text-white ${
          active ? 'text-[#C27E00]' : ''
        }`}
      >
        {label}
        {active ? (regionSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    )
  }

  function downloadRegionCsv() {
    const esc = (v: string | number) => {
      const s = String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const headers = [
      'Code',
      'Region',
      'Dealers',
      'Stock rows',
      'Units on hand',
      '30d consumption',
      'Short SKUs',
      'Below min SKUs',
      'Status',
    ]
    const lines = [
      headers.join(','),
      ...sortedRegionRows.map((r) => {
        const st = regionRowStatus(r)
        return [
          esc(r.code),
          esc(r.name),
          r.dealers.size,
          r.stockRowCount,
          r.units,
          r.consumption30,
          r.shortSkus,
          r.belowMinSkus,
          regionStatusLabel(st),
        ].join(',')
      }),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `inventory-by-region-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function downloadMovementsCsv() {
    const esc = (v: string | number | null | undefined) => {
      const s = String(v ?? '')
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const headers = ['When (PT)', 'Dealer', 'Camera', 'Type', 'Delta', 'Note', 'Demand ref']
    const lines = [
      headers.join(','),
      ...filteredMovements.map((m) =>
        [
          esc(formatInPT(m.created_at, 'dd.MM.yyyy HH:mm:ss')),
          esc(m.dealers?.name ?? ''),
          esc(m.camera_models?.name ?? ''),
          esc(m.movement_type),
          m.quantity_delta,
          esc(m.note ?? ''),
          esc(m.reference_demand_id ?? ''),
        ].join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `inventory-movements-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function onMovement(formData: FormData) {
    setMsg(null)
    const r = await addManualInventoryMovement(formData)
    if (r.error) setMsg({ type: 'err', text: r.error })
    else {
      setMsg({ type: 'ok', text: 'Movement recorded.' })
      setMovDealerId('')
      setMovCameraId('')
      setMovMovementType('receipt')
      setMovQty('')
      setMovNote('')
      router.refresh()
    }
  }

  async function onThreshold(formData: FormData) {
    setMsg(null)
    const r = await upsertInventoryThreshold(formData)
    if (r.error) setMsg({ type: 'err', text: r.error })
    else {
      setMsg({ type: 'ok', text: 'Threshold saved.' })
      setThrDealerId('')
      setThrCameraId('')
      setThrMinQty('')
      router.refresh()
    }
  }

  async function handleInventoryReset() {
    if (resetConfirmText.trim() !== 'RESET') {
      setMsg({ type: 'err', text: 'Type RESET (all caps) to confirm.' })
      return
    }
    setResetPending(true)
    setMsg(null)
    const r = await resetInventoryStockData()
    setResetPending(false)
    if (r.error) setMsg({ type: 'err', text: r.error })
    else {
      setMsg({ type: 'ok', text: r.success ?? 'Inventory stock data reset.' })
      setResetConfirmText('')
      router.refresh()
    }
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview & HQ', icon: Warehouse },
    { id: 'dealers' as const, label: 'By dealer', icon: Package },
    { id: 'regions' as const, label: 'By region', icon: Activity },
    { id: 'movements' as const, label: 'Movements', icon: TrendingDown },
    { id: 'manual' as const, label: 'Receipt / adjust', icon: Package },
  ]

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            msg.type === 'ok'
              ? 'border-green-800 bg-green-950/40 text-green-200'
              : 'border-red-800 bg-red-950/40 text-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-gray-800 pb-3">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-[#C27E00]/20 text-[#C27E00] border border-[#C27E00]/40'
                  : 'text-zinc-500 dark:text-gray-400 border border-transparent hover:bg-zinc-200/50 dark:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && (
        <div className="space-y-8">
          <p className="text-sm text-zinc-500 dark:text-gray-400">
            <strong className="text-zinc-600 dark:text-gray-300 font-medium">HQ total</strong> is catalog reference only;{' '}
            <strong className="text-zinc-600 dark:text-gray-300 font-medium">all dealers on hand</strong> comes from movements. Negative
            field totals mean installs exceeded recorded stock-in — not that HQ auto-shipped units.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setIssuesOnly(true)
                setDealerFilterId('')
                setCameraFilterId('')
                setRegionFilterCode('')
                setTab('dealers')
              }}
              className="rounded-lg border border-[#C27E00]/40 bg-[#C27E00]/10 px-3 py-1.5 text-xs font-medium text-[#C27E00] hover:bg-[#C27E00]/20"
            >
              By dealer · issues
            </button>
            <button
              type="button"
              onClick={() => setTab('manual')}
              className="rounded-lg border border-zinc-300 dark:border-gray-600 px-3 py-1.5 text-xs text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5"
            >
              Receipt / adjust
            </button>
            <button
              type="button"
              onClick={downloadOverviewCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-gray-600 px-3 py-1.5 text-xs text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5"
            >
              <Download className="w-3.5 h-3.5" />
              Export HQ table CSV
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Catalog models</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">{overviewHqAnalytics.modelRows.length}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">HQ units (sum)</p>
              <p className="text-lg font-semibold text-[#C27E00] tabular-nums">{overviewHqAnalytics.totalHq}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Dealers on hand (sum)</p>
              <p
                className={`text-lg font-semibold tabular-nums ${overviewHqAnalytics.totalDealers < 0 ? 'text-red-400' : 'text-zinc-800 dark:text-gray-200'}`}
              >
                {overviewHqAnalytics.totalDealers}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Notional HQ + field</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">{overviewHqAnalytics.notionalTotal}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Models w/ neg. field</p>
              <p
                className={`text-lg font-semibold tabular-nums ${overviewHqAnalytics.negModels > 0 ? 'text-red-300' : 'text-zinc-900 dark:text-white'}`}
              >
                {overviewHqAnalytics.negModels}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Short SKU lines</p>
              <p
                className={`text-lg font-semibold tabular-nums ${overviewHqAnalytics.shortSkuCount > 0 ? 'text-red-400' : 'text-zinc-900 dark:text-white'}`}
              >
                {overviewHqAnalytics.shortSkuCount}
              </p>
            </div>
          </div>

          <section className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-white/[0.03] p-4 space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
              <Warehouse className="w-4 h-4 text-[#C27E00]" />
              Analysis & charts
            </h3>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-gray-400">HQ total vs dealer aggregate (per model)</p>
                {overviewHqAnalytics.modelRows.length === 0 ? (
                  <p className="text-zinc-500 dark:text-gray-500 text-sm py-10">No models.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={overviewHqAnalytics.modelRows}
                      margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                      <XAxis dataKey="shortLabel" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={52} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        labelFormatter={(_, p) => {
                          const pl = p?.[0]?.payload as { name?: string } | undefined
                          return pl?.name ?? ''
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '11px' }}
                        formatter={(v) => <span className="text-zinc-600 dark:text-gray-300">{v}</span>}
                      />
                      <Bar dataKey="hq" name="HQ total" fill="#C27E00" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="dealers" name="Dealers on hand" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-gray-400">Positive field inventory by model (share)</p>
                {overviewHqAnalytics.pieData.length === 0 ? (
                  <p className="text-zinc-500 dark:text-gray-500 text-sm py-10">
                    No positive dealer rollups — field totals are zero or negative for every model. Use receipts to
                    rebuild on-hand.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={overviewHqAnalytics.pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {overviewHqAnalytics.pieData.map((e, i) => (
                          <Cell key={`ov-pie-${e.name}-${i}`} fill={e.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number | undefined, name: string | undefined) => {
                          const sum = overviewHqAnalytics.pieData.reduce((s, x) => s + x.value, 0) || 1
                          const v = value ?? 0
                          return [`${v} (${Math.round((v / sum) * 100)}%)`, name ?? '']
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '10px' }}
                        formatter={(v) => <span className="text-zinc-600 dark:text-gray-300">{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 p-4 space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-[#C27E00]" />
              Insights &amp; suggestions
            </h2>
            <div className="space-y-3">
              {overviewInsights.map((s, i) => (
                <div
                  key={`ov-ins-${i}`}
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    s.level === 'warning'
                      ? 'border-amber-800/60 bg-amber-950/30 text-amber-100'
                      : 'border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 text-zinc-800 dark:text-gray-200'
                  }`}
                >
                  <p className="font-medium text-zinc-900 dark:text-white">{s.title}</p>
                  <p className="text-zinc-500 dark:text-gray-400 mt-1">{s.detail}</p>
                </div>
              ))}
              {suggestions.map((s, i) => (
                <div
                  key={`ov-sug-${i}`}
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    s.level === 'warning'
                      ? 'border-amber-800/60 bg-amber-950/30 text-amber-100'
                      : 'border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 text-zinc-800 dark:text-gray-200'
                  }`}
                >
                  <p className="font-medium text-zinc-900 dark:text-white">{s.title}</p>
                  <p className="text-zinc-500 dark:text-gray-400 mt-1">{s.detail}</p>
                </div>
              ))}
              {suggestions.length === 0 && (
                <p className="text-zinc-500 dark:text-gray-500 text-sm border-t border-zinc-200 dark:border-gray-800 pt-3">
                  No threshold-based alerts from the server. Add minimums under Receipt / adjust for automated low-stock
                  messages in this list.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 p-4 space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Add new camera model</h2>
            <p className="text-sm text-zinc-500 dark:text-gray-500">
              Creates a catalog entry (same as Platform Management → Cameras). Assign to dealers there if needed.
            </p>
            <form id="inv-new-camera-form" action={createCamAction} className="space-y-3 max-w-2xl">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">Model name *</label>
                <input
                  name="name"
                  required
                  className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-3 py-2 text-zinc-900 dark:text-white text-sm placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                  placeholder="e.g. 2-Channel"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">Description (optional)</label>
                <textarea
                  name="description"
                  rows={2}
                  className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-3 py-2 text-zinc-900 dark:text-white text-sm placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                  placeholder="Optional notes…"
                />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">Initial HQ total quantity *</label>
                  <input
                    name="stockQuantity"
                    type="number"
                    min={0}
                    required
                    defaultValue={0}
                    className="w-40 rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-3 py-2 text-zinc-900 dark:text-white text-sm tabular-nums focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={createCamPending}
                  className="rounded-lg bg-[#C27E00] hover:bg-[#a06900] disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
                >
                  {createCamPending ? 'Adding…' : 'Add model'}
                </button>
              </div>
            </form>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">HQ catalog (reference)</h2>
            </div>
            <p className="text-sm text-zinc-500 dark:text-gray-500 mb-2">
              HQ total per model (<code className="text-zinc-500 dark:text-gray-400">stock_quantity</code>) — not reduced by dealer inventory movements. Edit below or in Configuration → Cameras.
            </p>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-gray-800">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-200/50 dark:bg-white/5 text-zinc-500 dark:text-gray-400 text-left">
                  <tr>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2 text-right">HQ total (editable)</th>
                    <th className="px-3 py-2 text-right">All dealers on hand</th>
                    <th className="px-3 py-2 text-right">Notional</th>
                    <th className="px-3 py-2 text-right w-[1%] whitespace-nowrap">Drill down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-gray-800 text-zinc-800 dark:text-gray-200">
                  {cameras.map((c) => {
                    const row = overviewHqAnalytics.modelRows.find((r) => r.id === c.id)
                    const dealersQty = overallByModel[c.id] ?? 0
                    const notional = row?.notional ?? (c.stock_quantity ?? 0) + dealersQty
                    const negRow = dealersQty < 0
                    return (
                      <tr key={c.id} className={negRow ? 'bg-red-950/20' : undefined}>
                        <td className="px-3 py-2">{c.name}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <input
                              id={`hq-stock-${c.id}`}
                              key={`${c.id}-${c.stock_quantity ?? 0}`}
                              type="number"
                              min={0}
                              defaultValue={c.stock_quantity ?? 0}
                              className="w-24 rounded border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-2 py-1.5 text-zinc-900 dark:text-white text-sm text-right tabular-nums focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                            />
                            <button
                              type="button"
                              onClick={() => void saveHqStock(c.id)}
                              disabled={hqSavingId === c.id}
                              className="shrink-0 rounded border border-[#C27E00]/50 bg-[#C27E00]/15 px-2 py-1.5 text-xs font-medium text-[#C27E00] hover:bg-[#C27E00]/25 disabled:opacity-50"
                            >
                              {hqSavingId === c.id ? '…' : 'Save'}
                            </button>
                          </div>
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${negRow ? 'text-red-300 font-medium' : ''}`}
                        >
                          {dealersQty}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-gray-400">{notional}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setCameraFilterId(c.id)
                              setDealerFilterId('')
                              setRegionFilterCode('')
                              setIssuesOnly(false)
                              setTab('dealers')
                            }}
                            className="rounded border border-zinc-300 dark:border-gray-600 px-2 py-1 text-[10px] text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5"
                          >
                            By dealer
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === 'dealers' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-gray-400">
            Negative on hand means demand was recorded without enough receipts — use <strong className="text-zinc-600 dark:text-gray-300 font-medium">Receipt / adjust</strong> or row actions below.
          </p>

          {suggestions.length > 0 && (
            <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-200 text-sm font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Suggestions (also on Overview)
              </div>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-gray-300">
                {suggestions.slice(0, 5).map((s, i) => (
                  <li key={i} className="border-l-2 border-amber-700/60 pl-3">
                    <span className="text-zinc-900 dark:text-white font-medium">{s.title}</span>
                    <span className="text-zinc-500 dark:text-gray-500"> — </span>
                    {s.detail}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Rows (filtered)</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">{dealerKpis.rows}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Short (on hand &lt; 0)</p>
              <p
                className={`text-lg font-semibold tabular-nums ${dealerKpis.neg > 0 ? 'text-red-400' : 'text-zinc-900 dark:text-white'}`}
              >
                {dealerKpis.neg}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Below min</p>
              <p
                className={`text-lg font-semibold tabular-nums ${dealerKpis.below > 0 ? 'text-amber-300' : 'text-zinc-900 dark:text-white'}`}
              >
                {dealerKpis.below}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">30d installs (filtered)</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">{dealerKpis.installs}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 dark:border-gray-800 bg-white/[0.03] p-3">
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-gray-400 text-xs shrink-0">
              <Filter className="w-4 h-4" />
              <span className="uppercase tracking-wider">Filters</span>
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="block text-[10px] text-zinc-500 dark:text-gray-500 uppercase mb-1">Dealer</label>
              <select
                value={dealerFilterId}
                onChange={(e) => setDealerFilterId(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white"
              >
                <option value="">All</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-zinc-500 dark:text-gray-500 uppercase mb-1">Region</label>
              <select
                value={regionFilterCode}
                onChange={(e) => setRegionFilterCode(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white"
              >
                <option value="">All</option>
                {regionsList.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="block text-[10px] text-zinc-500 dark:text-gray-500 uppercase mb-1">Camera</label>
              <select
                value={cameraFilterId}
                onChange={(e) => setCameraFilterId(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white"
              >
                <option value="">All</option>
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-zinc-600 dark:text-gray-300 pt-5 sm:pt-0">
              <input
                type="checkbox"
                checked={issuesOnly}
                onChange={(e) => setIssuesOnly(e.target.checked)}
                className="rounded border-zinc-300 dark:border-gray-600 bg-zinc-200 dark:bg-gray-900"
              />
              Issues only
            </label>
            <button
              type="button"
              onClick={() => {
                setDealerFilterId('')
                setRegionFilterCode('')
                setCameraFilterId('')
                setIssuesOnly(false)
              }}
              className="rounded-md border border-zinc-300 dark:border-gray-600 px-3 py-1.5 text-xs text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={downloadDealerCsv}
              className="ml-auto inline-flex items-center gap-2 rounded-md bg-[#C27E00]/90 hover:bg-[#a06900] px-3 py-1.5 text-xs font-medium text-white"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-200/50 dark:bg-white/5 text-zinc-500 dark:text-gray-400 text-left">
                <tr>
                  <th className="px-3 py-2">{sortHeader('Dealer', 'dealer')}</th>
                  <th className="px-3 py-2">{sortHeader('Region', 'region')}</th>
                  <th className="px-3 py-2">{sortHeader('Camera', 'camera')}</th>
                  <th className="px-3 py-2 text-right">{sortHeader('On hand', 'qty')}</th>
                  <th className="px-3 py-2 text-right">{sortHeader('30d installs', 'installs')}</th>
                  <th className="px-3 py-2 text-right">{sortHeader('Min', 'min')}</th>
                  <th className="px-3 py-2">{sortHeader('Status', 'status')}</th>
                  <th className="px-3 py-2 text-right w-[1%] whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800 text-zinc-800 dark:text-gray-200">
                {sortedDealerRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-zinc-500 dark:text-gray-500">
                      No rows match filters.
                    </td>
                  </tr>
                ) : (
                  sortedDealerRows.map((r) => {
                    const rowBg =
                      r.negative
                        ? 'bg-red-950/25'
                        : r.belowMin
                          ? 'bg-amber-950/15'
                          : undefined
                    const qtyCls = r.negative
                      ? 'text-red-300 font-medium'
                      : r.belowMin
                        ? 'text-amber-200'
                        : 'text-zinc-800 dark:text-gray-200'
                    const statusCls =
                      r.status === 'negative'
                        ? 'text-red-300'
                        : r.status === 'below_min'
                          ? 'text-amber-300'
                          : 'text-zinc-500 dark:text-gray-500'
                    return (
                      <tr key={r.k} className={rowBg}>
                        <td className="px-3 py-2">{r.d?.name ?? r.dealer_id}</td>
                        <td className="px-3 py-2 text-zinc-500 dark:text-gray-400">{r.d?.region_codes?.code ?? '—'}</td>
                        <td className="px-3 py-2">{r.c?.name ?? r.camera_model_id}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${qtyCls}`}>{r.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.cons}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-gray-500">
                          {r.t?.min_qty ?? '—'}
                        </td>
                        <td className={`px-3 py-2 text-xs font-medium ${statusCls}`}>
                          {dealerStatusLabel(r.status)}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="flex flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setReceiptJump({ dealer_id: r.dealer_id, camera_model_id: r.camera_model_id })
                                setTab('manual')
                              }}
                              className="rounded border border-[#C27E00]/40 bg-[#C27E00]/10 px-2 py-1 text-[10px] font-medium text-[#C27E00] hover:bg-[#C27E00]/20"
                            >
                              Receipt
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setThresholdJump({
                                  dealer_id: r.dealer_id,
                                  camera_model_id: r.camera_model_id,
                                  min_qty: r.t?.min_qty,
                                })
                                setTab('manual')
                              }}
                              className="rounded border border-zinc-300 dark:border-gray-600 px-2 py-1 text-[10px] text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5"
                            >
                              Set min
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'regions' && (
        <div className="space-y-4">
          <div className="space-y-2 text-sm text-zinc-500 dark:text-gray-400">
            <p>
              <strong className="text-zinc-600 dark:text-gray-300 font-medium">Units on hand</strong> is the sum of all dealer / camera
              balances in the region. It can be negative when installs outpaced receipts.{' '}
              <strong className="text-zinc-600 dark:text-gray-300 font-medium">Short SKUs</strong> counts rows where on hand is below zero;
              the region can still look &quot;less bad&quot; in total if other lines offset — check{' '}
              <button
                type="button"
                onClick={() => setTab('dealers')}
                className="text-[#C27E00] hover:underline font-medium"
              >
                By dealer
              </button>{' '}
              for line-level fixes and receipts.
            </p>
          </div>

          {suggestions.length > 0 && (
            <section className="rounded-lg border border-zinc-300 dark:border-gray-700/80 bg-white/[0.03] p-4 space-y-2">
              <div className="flex items-center gap-2 text-zinc-800 dark:text-gray-200 text-sm font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                Cross-region alerts (from Overview suggestions)
              </div>
              <ul className="space-y-1.5 text-sm text-zinc-500 dark:text-gray-400">
                {suggestions.slice(0, 4).map((s, i) => (
                  <li key={i}>
                    <span className="text-zinc-800 dark:text-gray-200">{s.title}</span>
                    <span className="text-zinc-600 dark:text-gray-600"> — </span>
                    {s.detail}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Regions (filtered)</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">{regionKpis.rows}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Need action</p>
              <p
                className={`text-lg font-semibold tabular-nums ${regionKpis.critical > 0 ? 'text-red-400' : 'text-zinc-900 dark:text-white'}`}
              >
                {regionKpis.critical}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Below min (region)</p>
              <p
                className={`text-lg font-semibold tabular-nums ${regionKpis.below > 0 ? 'text-amber-300' : 'text-zinc-900 dark:text-white'}`}
              >
                {regionKpis.below}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Short SKUs (filtered)</p>
              <p
                className={`text-lg font-semibold tabular-nums ${regionKpis.shortSkus > 0 ? 'text-red-300' : 'text-zinc-900 dark:text-white'}`}
              >
                {regionKpis.shortSkus}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 dark:border-gray-800 bg-white/[0.03] p-3">
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-gray-400 text-xs shrink-0">
              <Filter className="w-4 h-4" />
              <span className="uppercase tracking-wider">Filters</span>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="block text-[10px] text-zinc-500 dark:text-gray-500 uppercase mb-1">Search code or name</label>
              <input
                type="search"
                value={regionSearch}
                onChange={(e) => setRegionSearch(e.target.value)}
                placeholder="e.g. SRY, Richmond"
                className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-600 dark:text-gray-600"
              />
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-zinc-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={regionIssuesOnly}
                onChange={(e) => setRegionIssuesOnly(e.target.checked)}
                className="rounded border-zinc-300 dark:border-gray-600 bg-zinc-200 dark:bg-gray-900"
              />
              Issues only
            </label>
            <button
              type="button"
              onClick={() => {
                setRegionSearch('')
                setRegionIssuesOnly(false)
              }}
              className="rounded-md border border-zinc-300 dark:border-gray-600 px-3 py-1.5 text-xs text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={downloadRegionCsv}
              className="ml-auto inline-flex items-center gap-2 rounded-md bg-[#C27E00]/90 hover:bg-[#a06900] px-3 py-1.5 text-xs font-medium text-white"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-200/50 dark:bg-white/5 text-zinc-500 dark:text-gray-400 text-left">
                <tr>
                  <th className="px-3 py-2">{regionSortHeader('Code', 'code')}</th>
                  <th className="px-3 py-2">{regionSortHeader('Region', 'name')}</th>
                  <th className="px-3 py-2 text-right">{regionSortHeader('Dealers', 'dealers')}</th>
                  <th className="px-3 py-2 text-right">{regionSortHeader('Stock rows', 'rows')}</th>
                  <th className="px-3 py-2 text-right">{regionSortHeader('On hand', 'units')}</th>
                  <th className="px-3 py-2 text-right">{regionSortHeader('30d use', 'consumption')}</th>
                  <th className="px-3 py-2 text-right">{regionSortHeader('Short', 'short')}</th>
                  <th className="px-3 py-2 text-right">{regionSortHeader('Below min', 'belowMin')}</th>
                  <th className="px-3 py-2">{regionSortHeader('Status', 'status')}</th>
                  <th className="px-3 py-2 text-right w-[1%] whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800 text-zinc-800 dark:text-gray-200">
                {sortedRegionRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-zinc-500 dark:text-gray-500">
                      No regions match filters.
                    </td>
                  </tr>
                ) : (
                  sortedRegionRows.map((r) => {
                    const st = regionRowStatus(r)
                    const rowBg =
                      st === 'critical'
                        ? 'bg-red-950/25'
                        : st === 'below_min'
                          ? 'bg-amber-950/15'
                          : undefined
                    const unitsCls =
                      r.units < 0 ? 'text-red-300 font-medium' : st === 'below_min' ? 'text-amber-100' : ''
                    const shortCls = r.shortSkus > 0 ? 'text-red-300 font-medium' : 'text-zinc-500 dark:text-gray-500'
                    const statusCls =
                      st === 'critical'
                        ? 'text-red-300'
                        : st === 'below_min'
                          ? 'text-amber-300'
                          : 'text-zinc-500 dark:text-gray-500'
                    const hint =
                      r.shortSkus > 0 && r.units < 0
                        ? `${r.shortSkus} SKU(s) short; net negative`
                        : r.shortSkus > 0
                          ? `${r.shortSkus} SKU(s) on hand below zero`
                          : r.units < 0
                            ? 'Net negative (offsets across SKUs)'
                            : undefined
                    return (
                      <tr key={r.code} className={rowBg} title={hint}>
                        <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">{r.code}</td>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.dealers.size}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-gray-400">{r.stockRowCount}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${unitsCls}`}>{r.units}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.consumption30}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${shortCls}`}>{r.shortSkus}</td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${r.belowMinSkus > 0 ? 'text-amber-200' : 'text-zinc-500 dark:text-gray-500'}`}
                        >
                          {r.belowMinSkus}
                        </td>
                        <td className={`px-3 py-2 text-xs font-medium ${statusCls}`}>
                          {regionStatusLabel(st)}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="flex flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setRegionFilterCode(r.code)
                                setDealerFilterId('')
                                setCameraFilterId('')
                                setIssuesOnly(false)
                                setTab('dealers')
                              }}
                              className="rounded border border-[#C27E00]/40 bg-[#C27E00]/10 px-2 py-1 text-[10px] font-medium text-[#C27E00] hover:bg-[#C27E00]/20"
                            >
                              By dealer
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRegionFilterCode(r.code)
                                setIssuesOnly(true)
                                setDealerFilterId('')
                                setCameraFilterId('')
                                setTab('dealers')
                              }}
                              className="rounded border border-zinc-300 dark:border-gray-600 px-2 py-1 text-[10px] text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5"
                            >
                              Issues in region
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'movements' && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500 dark:text-gray-500">
            Timestamps in {SYSTEM_DEFAULT_TIMEZONE.replace('_', ' ')} (PT) — same base timezone as appointments and
            calendar. Charts and KPIs reflect the filtered list below (not the full history if the server caps rows).
          </p>

          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 dark:border-gray-800 bg-white/[0.03] p-3">
            <div className="min-w-[120px]">
              <label className="block text-[10px] text-zinc-500 dark:text-gray-500 uppercase mb-1">Window</label>
              <select
                value={movDaysPreset}
                onChange={(e) => setMovDaysPreset(e.target.value as '7' | '30' | '90' | 'all')}
                className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="all">All loaded rows</option>
              </select>
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="block text-[10px] text-zinc-500 dark:text-gray-500 uppercase mb-1">Dealer</label>
              <select
                value={movFilterDealer}
                onChange={(e) => setMovFilterDealer(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white"
              >
                <option value="">All</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px]">
              <label className="block text-[10px] text-zinc-500 dark:text-gray-500 uppercase mb-1">Type</label>
              <select
                value={movFilterType}
                onChange={(e) => setMovFilterType(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white"
              >
                <option value="">All</option>
                {movementTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setMovFilterDealer('')
                setMovFilterType('')
                setMovDaysPreset('30')
              }}
              className="rounded-md border border-zinc-300 dark:border-gray-600 px-3 py-1.5 text-xs text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5"
            >
              Reset filters
            </button>
            <button
              type="button"
              onClick={downloadMovementsCsv}
              className="inline-flex items-center gap-2 rounded-md border border-[#C27E00]/50 bg-[#C27E00]/15 px-3 py-1.5 text-xs font-medium text-[#C27E00] hover:bg-[#C27E00]/25"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <p className="text-xs text-zinc-500 dark:text-gray-500 ml-auto self-center">
              Showing {filteredMovements.length} of {movements.length} loaded
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Events (filtered)</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">{movementAnalytics.eventCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Net Δ qty</p>
              <p
                className={`text-lg font-semibold tabular-nums ${movementAnalytics.netDeltaSum < 0 ? 'text-red-300' : movementAnalytics.netDeltaSum > 0 ? 'text-green-300' : 'text-zinc-900 dark:text-white'}`}
              >
                {movementAnalytics.netDeltaSum > 0 ? '+' : ''}
                {movementAnalytics.netDeltaSum}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Consumptions</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">{movementAnalytics.consumptionCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Receipt rows</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">{movementAnalytics.receiptCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 sm:col-span-2 lg:col-span-1">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Date span (PT)</p>
              <p className="text-sm font-medium text-zinc-800 dark:text-gray-200 tabular-nums">
                {movementAnalytics.dateMin && movementAnalytics.dateMax
                  ? `${movementAnalytics.dateMin} → ${movementAnalytics.dateMax}`
                  : '—'}
              </p>
            </div>
          </div>

          {(movementInsights.length > 0 || suggestions.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {movementInsights.length > 0 && (
                <section className="rounded-lg border border-zinc-300 dark:border-gray-700/80 bg-white/[0.03] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white">
                    <BarChart3 className="w-4 h-4 text-[#C27E00]" />
                    Movement insights (this filter)
                  </div>
                  <ul className="space-y-2">
                    {movementInsights.map((s, i) => (
                      <li
                        key={i}
                        className={`rounded-md border px-3 py-2 text-sm ${
                          s.level === 'warning'
                            ? 'border-amber-800/50 bg-amber-950/25 text-amber-100'
                            : 'border-zinc-300 dark:border-gray-700/60 bg-white/[0.02] text-zinc-600 dark:text-gray-300'
                        }`}
                      >
                        <p className="font-medium text-zinc-900 dark:text-white">{s.title}</p>
                        <p className="text-zinc-500 dark:text-gray-400 mt-0.5">{s.detail}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {suggestions.length > 0 && (
                <section className="rounded-lg border border-amber-900/35 bg-amber-950/15 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-100">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Inventory suggestions (Overview)
                  </div>
                  <ul className="space-y-2 text-sm text-zinc-600 dark:text-gray-300">
                    {suggestions.slice(0, 5).map((s, i) => (
                      <li key={i}>
                        <span className="text-zinc-900 dark:text-white font-medium">{s.title}</span>
                        <span className="text-zinc-600 dark:text-gray-600"> — </span>
                        {s.detail}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          <section className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-white/[0.03] p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Charts</h3>
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2 space-y-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-gray-400">Activity by day (event counts, stacked by type)</p>
                {movementAnalytics.daily.length === 0 ? (
                  <p className="text-zinc-500 dark:text-gray-500 text-sm py-10">No rows to chart.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={movementAnalytics.daily} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                      <XAxis dataKey="dayLabel" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '11px' }}
                        formatter={(v) => <span className="text-zinc-600 dark:text-gray-300">{v}</span>}
                      />
                      <Bar dataKey="consumption" stackId="t" name="Consumption" fill="#f87171" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="receipt" stackId="t" name="Receipt" fill="#4ade80" />
                      <Bar dataKey="adjustment" stackId="t" name="Adjustment" fill="#fbbf24" />
                      <Bar dataKey="return_hq" stackId="t" name="Return HQ" fill="#a78bfa" />
                      <Bar dataKey="other" stackId="t" name="Other" fill="#9ca3af" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-gray-400">Mix (filtered)</p>
                {movementAnalytics.byType.length === 0 ? (
                  <p className="text-zinc-500 dark:text-gray-500 text-sm py-10">No rows.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={movementAnalytics.byType}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {movementAnalytics.byType.map((e, iU) => (
                          <Cell key={`mt-${e.raw}-${iU}`} fill={e.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number | undefined, name: string | undefined) => {
                          const total = movementAnalytics.eventCount || 1
                          const v = value ?? 0
                          return [`${v} (${Math.round((v / total) * 100)}%)`, name ?? '']
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '10px' }}
                        formatter={(v) => <span className="text-zinc-600 dark:text-gray-300">{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-gray-400">Consumption vs receipt events (daily)</p>
              {movementAnalytics.daily.length === 0 ? (
                <p className="text-zinc-500 dark:text-gray-500 text-sm py-6">No rows.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={movementAnalytics.daily} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                    <XAxis dataKey="dayLabel" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px' }}
                      formatter={(v) => <span className="text-zinc-600 dark:text-gray-300">{v}</span>}
                    />
                    <Line
                      type="monotone"
                      dataKey="consumption"
                      name="Consumption events"
                      stroke="#f87171"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="receipt"
                      name="Receipt events"
                      stroke="#4ade80"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-gray-400">Top dealers by movement count</p>
                {movementAnalytics.dealerBars.length === 0 ? (
                  <p className="text-zinc-500 dark:text-gray-500 text-sm py-8">No data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={movementAnalytics.dealerBars}
                      layout="vertical"
                      margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                      <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={108}
                        tick={{ fill: '#9ca3af', fontSize: 9 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number | undefined, _l, p) => {
                          const payload = p?.payload as { net?: number } | undefined
                          return [`${value ?? 0} moves (net Δ ${payload?.net ?? 0})`, '']
                        }}
                      />
                      <Bar dataKey="n" name="Movements" fill="#C27E00" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-gray-400">Top models by consumption events</p>
                {movementAnalytics.cameraBars.length === 0 ? (
                  <p className="text-zinc-500 dark:text-gray-500 text-sm py-8">No data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={movementAnalytics.cameraBars}
                      layout="vertical"
                      margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                      <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={118}
                        tick={{ fill: '#9ca3af', fontSize: 9 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number | undefined, _l, p) => {
                          const payload = p?.payload as { net?: number } | undefined
                          return [`${value ?? 0} consumption(s) (net Δ ${payload?.net ?? 0})`, '']
                        }}
                      />
                      <Bar dataKey="consumption" name="Consumption" fill="#60a5fa" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-gray-800 max-h-[70vh] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-200/50 dark:bg-white/5 text-zinc-500 dark:text-gray-400 text-left sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Dealer</th>
                  <th className="px-3 py-2">Camera</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Δ</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2">Demand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800 text-zinc-800 dark:text-gray-200">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-zinc-500 dark:text-gray-500">
                      No movements match filters.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2 whitespace-nowrap text-zinc-500 dark:text-gray-400">
                        {formatInPT(m.created_at, 'dd.MM.yyyy HH:mm:ss')}
                      </td>
                      <td className="px-3 py-2">{m.dealers?.name ?? '—'}</td>
                      <td className="px-3 py-2">{m.camera_models?.name ?? '—'}</td>
                      <td className="px-3 py-2 uppercase text-xs text-zinc-500 dark:text-gray-500">{m.movement_type}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.quantity_delta}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate text-zinc-500 dark:text-gray-400" title={m.note ?? ''}>
                        {m.note ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-zinc-500 dark:text-gray-500">
                        {m.reference_demand_id ? m.reference_demand_id.slice(0, 8) + '…' : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'manual' && (
        <div className="space-y-6">
          <p className="text-sm text-zinc-500 dark:text-gray-400">
            Log receipts, returns, and adjustments here. Thresholds drive low-stock messages on Overview. Use the analysis
            below to see where to focus first.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setIssuesOnly(true)
                setDealerFilterId('')
                setCameraFilterId('')
                setRegionFilterCode('')
                setTab('dealers')
              }}
              className="rounded-lg border border-[#C27E00]/40 bg-[#C27E00]/10 px-3 py-1.5 text-xs font-medium text-[#C27E00] hover:bg-[#C27E00]/20"
            >
              By dealer · issues
            </button>
            <button
              type="button"
              onClick={() => {
                setMovDaysPreset('30')
                setMovFilterDealer('')
                setMovFilterType('')
                setTab('movements')
              }}
              className="rounded-lg border border-zinc-300 dark:border-gray-600 px-3 py-1.5 text-xs text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5"
            >
              Movements (30d)
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Stock rows</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">{manualWorkspaceAnalytics.balanceRowsCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Short (on hand &lt; 0)</p>
              <p
                className={`text-lg font-semibold tabular-nums ${manualWorkspaceAnalytics.shortCount > 0 ? 'text-red-400' : 'text-zinc-900 dark:text-white'}`}
              >
                {manualWorkspaceAnalytics.shortCount}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Below min</p>
              <p
                className={`text-lg font-semibold tabular-nums ${manualWorkspaceAnalytics.belowMinCount > 0 ? 'text-amber-300' : 'text-zinc-900 dark:text-white'}`}
              >
                {manualWorkspaceAnalytics.belowMinCount}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Threshold coverage</p>
              <p className="text-lg font-semibold text-[#C27E00] tabular-nums">
                {manualWorkspaceAnalytics.coveragePct}%
              </p>
              <p className="text-[10px] text-zinc-600 dark:text-gray-600 mt-0.5">{manualWorkspaceAnalytics.withThr} with min set</p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Receipts (30d)</p>
              <p className="text-lg font-semibold text-green-300 tabular-nums">
                {manualWorkspaceAnalytics.receipts30}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 px-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase tracking-wider">Adj / ret HQ (30d)</p>
              <p className="text-sm font-semibold text-zinc-800 dark:text-gray-200 tabular-nums mt-1">
                {manualWorkspaceAnalytics.adjustments30}{' '}
                <span className="text-zinc-600 dark:text-gray-600 font-normal">adj</span>
                <span className="text-zinc-600 dark:text-gray-600 mx-1">·</span>
                {manualWorkspaceAnalytics.returns30}{' '}
                <span className="text-zinc-600 dark:text-gray-600 font-normal">ret</span>
              </p>
            </div>
          </div>

          {(manualInsights.length > 0 || suggestions.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {manualInsights.length > 0 && (
                <section className="rounded-lg border border-zinc-300 dark:border-gray-700/80 bg-white/[0.03] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white">
                    <ClipboardList className="w-4 h-4 text-[#C27E00]" />
                    Receipt / threshold insights
                  </div>
                  <ul className="space-y-2">
                    {manualInsights.map((s, i) => (
                      <li
                        key={i}
                        className={`rounded-md border px-3 py-2 text-sm ${
                          s.level === 'warning'
                            ? 'border-amber-800/50 bg-amber-950/25 text-amber-100'
                            : 'border-zinc-300 dark:border-gray-700/60 bg-white/[0.02] text-zinc-600 dark:text-gray-300'
                        }`}
                      >
                        <p className="font-medium text-zinc-900 dark:text-white">{s.title}</p>
                        <p className="text-zinc-500 dark:text-gray-400 mt-0.5">{s.detail}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {suggestions.length > 0 && (
                <section className="rounded-lg border border-amber-900/35 bg-amber-950/15 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-100">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Inventory suggestions (Overview)
                  </div>
                  <ul className="space-y-2 text-sm text-zinc-600 dark:text-gray-300">
                    {suggestions.slice(0, 5).map((s, i) => (
                      <li key={i}>
                        <span className="text-zinc-900 dark:text-white font-medium">{s.title}</span>
                        <span className="text-zinc-600 dark:text-gray-600"> — </span>
                        {s.detail}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          <section className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-white/[0.03] p-4 space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
              <BarChart3 className="w-4 h-4 text-[#C27E00]" />
              Workspace charts
            </h3>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-gray-400">Worst on-hand (short SKUs)</p>
                {manualWorkspaceAnalytics.shortBar.length === 0 ? (
                  <p className="text-zinc-500 dark:text-gray-500 text-sm py-10">No negative lines — stock is at or above zero everywhere.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={manualWorkspaceAnalytics.shortBar}
                      layout="vertical"
                      margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                      <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={132}
                        tick={{ fill: '#9ca3af', fontSize: 9 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        formatter={(v: number | undefined) => [v ?? 0, 'On hand']}
                      />
                      <Bar dataKey="qty" name="On hand" fill="#f87171" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-gray-400">Manual movements by day (14d, PT) — event counts</p>
                {manualWorkspaceAnalytics.manualDaily.length === 0 ? (
                  <p className="text-zinc-500 dark:text-gray-500 text-sm py-10">No receipt / adjustment / return rows in the last 14 days.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={manualWorkspaceAnalytics.manualDaily} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                      <XAxis dataKey="dayLabel" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '11px' }}
                        formatter={(v) => <span className="text-zinc-600 dark:text-gray-300">{v}</span>}
                      />
                      <Bar dataKey="receipt" stackId="m" name="Receipt" fill="#4ade80" />
                      <Bar dataKey="adjustment" stackId="m" name="Adjustment" fill="#fbbf24" />
                      <Bar dataKey="return_hq" stackId="m" name="Return HQ" fill="#a78bfa" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-gray-400">Threshold coverage (stock rows)</p>
                {manualWorkspaceAnalytics.thresholdPie.length === 0 ? (
                  <p className="text-zinc-500 dark:text-gray-500 text-sm py-10">No stock rows to chart.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={manualWorkspaceAnalytics.thresholdPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={2}
                      >
                        {manualWorkspaceAnalytics.thresholdPie.map((e, i) => (
                          <Cell key={`thr-${e.name}-${i}`} fill={e.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number | undefined, name: string | undefined) => {
                          const total = manualWorkspaceAnalytics.balanceRowsCount || 1
                          const v = value ?? 0
                          return [`${v} (${Math.round((v / total) * 100)}%)`, name ?? '']
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '11px' }}
                        formatter={(v) => <span className="text-zinc-600 dark:text-gray-300">{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-gray-400">Net manual Δ by dealer (30d, units)</p>
                {manualWorkspaceAnalytics.dealerNetBars.length === 0 ? (
                  <p className="text-zinc-500 dark:text-gray-500 text-sm py-10">No manual movements in the last 30 days.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={manualWorkspaceAnalytics.dealerNetBars}
                      layout="vertical"
                      margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                      <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" width={108} tick={{ fill: '#9ca3af', fontSize: 9 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        formatter={(v: number | undefined) => [v ?? 0, 'Net Δ']}
                      />
                      <Bar dataKey="net" name="Net Δ" fill="#C27E00" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 p-4 space-y-3">
              <h3 className="text-zinc-900 dark:text-white font-medium">Record movement</h3>
              <form id="mov-form" action={onMovement} className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Dealer</label>
                  <select
                    name="dealer_id"
                    required
                    value={movDealerId}
                    onChange={(e) => setMovDealerId(e.target.value)}
                    className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
                  >
                    <option value="">Select…</option>
                    {dealers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Camera model</label>
                  <select
                    name="camera_model_id"
                    required
                    value={movCameraId}
                    onChange={(e) => setMovCameraId(e.target.value)}
                    className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
                  >
                    <option value="">Select…</option>
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Type</label>
                  <select
                    name="movement_type"
                    required
                    value={movMovementType}
                    onChange={(e) => setMovMovementType(e.target.value)}
                    className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
                  >
                    <option value="receipt">Receipt (stock in)</option>
                    <option value="return_to_hq">Return to HQ (stock out)</option>
                    <option value="adjustment">Adjustment (+/- integer)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Quantity</label>
                  <input
                    name="quantity"
                    type="number"
                    required
                    value={movQty}
                    onChange={(e) => setMovQty(e.target.value)}
                    className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
                    placeholder="Positive for receipt/return magnitude; signed for adjustment"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Note (optional)</label>
                  <input
                    name="note"
                    type="text"
                    value={movNote}
                    onChange={(e) => setMovNote(e.target.value)}
                    className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#C27E00] hover:bg-[#a06900] text-white py-2 text-sm font-medium"
                >
                  Save movement
                </button>
              </form>
            </div>

            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-white/5 p-4 space-y-3">
              <h3 className="text-zinc-900 dark:text-white font-medium">Low-stock threshold</h3>
              <p className="text-xs text-zinc-500 dark:text-gray-500">When on hand drops below this, a warning appears in Suggestions.</p>
              <form id="thr-form" action={onThreshold} className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Dealer</label>
                  <select
                    name="dealer_id"
                    required
                    value={thrDealerId}
                    onChange={(e) => setThrDealerId(e.target.value)}
                    className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
                  >
                    <option value="">Select…</option>
                    {dealers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Camera model</label>
                  <select
                    name="camera_model_id"
                    required
                    value={thrCameraId}
                    onChange={(e) => setThrCameraId(e.target.value)}
                    className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
                  >
                    <option value="">Select…</option>
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Minimum on hand</label>
                  <input
                    name="min_qty"
                    type="number"
                    min={0}
                    required
                    value={thrMinQty}
                    onChange={(e) => setThrMinQty(e.target.value)}
                    className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg border border-[#C27E00]/50 text-[#C27E00] py-2 text-sm font-medium hover:bg-[#C27E00]/10"
                >
                  Save threshold
                </button>
              </form>
            </div>
          </div>

          <section className="rounded-lg border border-red-800/60 bg-red-950/25 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-red-200">Danger zone — reset stock data</h3>
            <p className="text-xs text-red-200/80 leading-relaxed">
              Deletes <strong>all</strong> rows in <code className="text-red-100/90">inventory_movements</code> (including
              consumption history). Sets every <code className="text-red-100/90">camera_models.stock_quantity</code> to{' '}
              <strong>0</strong>. Thresholds are unchanged; demands are unchanged. Enter stock again with Receipt; new completed
              demands will consume as usual.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="inv-reset-confirm" className="block text-xs text-red-200/90 mb-1">
                  Type RESET to confirm
                </label>
                <input
                  id="inv-reset-confirm"
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET"
                  autoComplete="off"
                  className="w-full max-w-sm rounded border border-red-800/50 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                />
              </div>
              <button
                type="button"
                disabled={resetPending || resetConfirmText.trim() !== 'RESET'}
                onClick={() => void handleInventoryReset()}
                className="rounded-lg border border-red-600 bg-red-900/50 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-900/80 disabled:opacity-40 disabled:pointer-events-none"
              >
                {resetPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Resetting…
                  </span>
                ) : (
                  'Reset all inventory stock data'
                )}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
