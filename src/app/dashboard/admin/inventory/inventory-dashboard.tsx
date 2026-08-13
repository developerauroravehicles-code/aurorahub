'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Package, MapPin } from 'lucide-react'
import type { InventoryStockAlert, InventoryStockSummary } from '@/lib/inventory-stock-alerts'
import type { InventoryAlertRule } from '@/lib/inventory-alert-rules'
import type { InventoryTreeLevel } from '@/lib/inventory-v2/types'
import type { SpecialistStockSummaryRow } from '@/lib/inventory-v2/specialist-stock'
import { InventoryAlertsPanel, InventoryDashboardPanel } from './inventory-overview-panels'
import { InventorySpecialistsPanel } from './inventory-specialists-panel'
import {
  postDealerToSpecialistTransfer,
  postInventoryAdjustment,
  postInventoryAllocation,
  postInventoryReceipt,
  postInventoryReturn,
  createInventoryCity,
  createInventoryRegion,
  resetInventoryV2Data,
  upsertInventoryPricingRule,
  upsertInventoryThreshold,
} from './actions'

type TabId = 'dashboard' | 'alerts' | 'stock' | 'specialists' | 'movements' | 'pricing' | 'setup'

type Camera = { id: string; name: string }
type Province = { id: string; code: string; name: string }
type City = {
  id: string
  code: string
  name: string
  province_id: string
  inventory_provinces?: { code: string; name: string } | null
}
type Region = {
  id: string
  code: string
  name: string
  city_id: string
  province_id: string
  inventory_cities?: { code: string; name: string } | null
}
type Location = {
  id: string
  location_type: string
  label: string
  province_id: string | null
  city_id: string | null
  region_id: string | null
  dealer_id: string | null
}
type Balance = { location_id: string; camera_model_id: string; quantity: number }
type Threshold = { location_id: string; camera_model_id: string; min_qty: number }
type Movement = {
  id: string
  movement_type: string
  quantity: number
  note: string | null
  created_at: string
  camera_model_id: string
  camera_models: { name: string } | null
  from_loc: { label: string } | null
  to_loc: { label: string } | null
}
type Dealer = {
  id: string
  name: string
  inventory_region_id: string | null
  inventory_regions?: {
    code: string
    name: string
    city_id: string
    inventory_cities?: { name: string; code: string } | null
  } | null
}
type Specialist = { id: string; full_name: string | null }
type PricingRule = {
  id: string
  scope_type: string
  scope_id: string | null
  camera_model_id: string | null
  service_type: string
  price_cad: number
}

type Nav = {
  provinceId?: string
  cityId?: string
  regionId?: string
  dealerId?: string
}

const inputClass =
  'rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]'
const btnPrimary = 'rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white hover:bg-[#a06900] disabled:opacity-50'
const btnSecondary =
  'rounded-md border border-zinc-300 dark:border-gray-700 px-4 py-2 text-sm text-zinc-700 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-white/5'

function qtyClass(q: number) {
  if (q < 0) return 'text-red-400 font-semibold'
  if (q === 0) return 'text-zinc-400'
  return 'text-zinc-900 dark:text-white'
}

function navLevel(nav: Nav): InventoryTreeLevel {
  if (nav.dealerId) return 'dealer'
  if (nav.regionId) return 'region'
  if (nav.cityId) return 'city'
  if (nav.provinceId) return 'province'
  return 'national'
}

const STOCK_FLOW = [
  { key: 'national', tr: 'Kanada', en: 'Canada' },
  { key: 'province', tr: 'Eyalet', en: 'Province' },
  { key: 'city', tr: 'Şehir', en: 'City' },
  { key: 'region', tr: 'İç bölge', en: 'Inner region' },
  { key: 'dealer', tr: 'Bayi', en: 'Dealer' },
] as const

function levelGuide(level: InventoryTreeLevel): {
  title: string
  where: string
  click: string
  stock: string
  action: string
} {
  switch (level) {
    case 'national':
      return {
        title: 'Seviye 1 — Kanada (genel stok)',
        where: 'Tüm ülke stoku burada başlar.',
        click: 'Aşağıdan bir eyalete tıklayın (ör. BC).',
        stock: 'Sağdan Receipt ile kamera girişi yapın, sonra Allocate down ile eyalete dağıtın.',
        action: '1) Receipt → 2) Allocate down → BC',
      }
    case 'province':
      return {
        title: 'Seviye 2 — Eyalet',
        where: 'Eyalet stoğu (ör. British Columbia).',
        click: 'Bir şehre tıklayın (ör. Vancouver). Şehir yoksa Setup geography sekmesinden ekleyin.',
        stock: 'Üstten gelen stoku şehirlere Allocate down ile gönderin.',
        action: 'Şehir kartına tıklayın veya sağdan şehre allocate edin.',
      }
    case 'city':
      return {
        title: 'Seviye 3 — Şehir',
        where: 'Şehir stoğu (ör. Vancouver).',
        click: 'Bir iç bölgeye tıklayın (ör. East Vancouver).',
        stock: 'Stoku iç bölgelere Allocate down ile dağıtın.',
        action: 'İç bölge kartına tıklayın.',
      }
    case 'region':
      return {
        title: 'Seviye 4 — İç bölge',
        where: 'Mahalle / bölge stoğu (ör. East Vancouver).',
        click: 'Bayi kartına tıklayın. Bayi yoksa System Management → Dealers\'dan iç bölge atayın.',
        stock: 'Stoku bayilere Allocate down ile gönderin.',
        action: 'Bayi seçin veya sağdan allocate edin.',
      }
    case 'dealer':
      return {
        title: 'Seviye 5 — Bayi',
        where: 'Bayi stoğu — kurulum tamamlanınca otomatik 1 adet düşer.',
        click: 'Bu seviyede aşağı inme yok; specialist\'e manuel transfer yapılır.',
        stock: 'Stok burada tutulur. Specialist transfer formu altta.',
        action: 'Gerekirse sağdan adjustment veya alttan specialist transfer.',
      }
  }
}

export function InventoryDashboard({
  provinces,
  cities,
  regions,
  locations,
  balances,
  movements,
  thresholds,
  cameras,
  dealers,
  specialists,
  pricingRules,
  alerts,
  summary,
  customRules,
  nationalLocationId,
  specialistStock,
  initialTab,
}: {
  provinces: Province[]
  cities: City[]
  regions: Region[]
  locations: Location[]
  balances: Balance[]
  movements: Movement[]
  thresholds: Threshold[]
  cameras: Camera[]
  dealers: Dealer[]
  specialists: Specialist[]
  pricingRules: PricingRule[]
  alerts: InventoryStockAlert[]
  summary: InventoryStockSummary
  customRules: InventoryAlertRule[]
  nationalLocationId: string | null
  specialistStock: SpecialistStockSummaryRow[]
  initialTab?: TabId
}) {
  const router = useRouter()
  const [tab, setTab] = useState<TabId>(initialTab ?? 'dashboard')
  const [nav, setNav] = useState<Nav>({})
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const balanceMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of balances) m.set(`${b.location_id}:${b.camera_model_id}`, b.quantity)
    return m
  }, [balances])

  const locByProvince = useMemo(
    () => new Map(locations.filter((l) => l.location_type === 'province').map((l) => [l.province_id!, l])),
    [locations]
  )
  const locByCity = useMemo(
    () => new Map(locations.filter((l) => l.location_type === 'city').map((l) => [l.city_id!, l])),
    [locations]
  )
  const locByRegion = useMemo(
    () => new Map(locations.filter((l) => l.location_type === 'region').map((l) => [l.region_id!, l])),
    [locations]
  )
  const locByDealer = useMemo(
    () => new Map(locations.filter((l) => l.location_type === 'dealer').map((l) => [l.dealer_id!, l])),
    [locations]
  )

  function getQty(locationId: string | undefined, modelId: string) {
    if (!locationId) return 0
    return balanceMap.get(`${locationId}:${modelId}`) ?? 0
  }

  function totalAtLocation(locationId: string | undefined) {
    if (!locationId) return 0
    return cameras.reduce((s, c) => s + getQty(locationId, c.id), 0)
  }

  function runAction(fn: () => Promise<{ error?: string; success?: boolean | string }>) {
    setMessage(null)
    startTransition(async () => {
      const res = await fn()
      if (res.error) setMessage({ type: 'err', text: res.error })
      else {
        setMessage({ type: 'ok', text: typeof res.success === 'string' ? res.success : 'Saved.' })
        router.refresh()
      }
    })
  }

  const level = navLevel(nav)
  const province = nav.provinceId ? provinces.find((p) => p.id === nav.provinceId) : null
  const city = nav.cityId ? cities.find((c) => c.id === nav.cityId) : null
  const region = nav.regionId ? regions.find((r) => r.id === nav.regionId) : null
  const dealer = nav.dealerId ? dealers.find((d) => d.id === nav.dealerId) : null

  const currentLocationId = useMemo(() => {
    if (level === 'national') return nationalLocationId ?? undefined
    if (level === 'province' && nav.provinceId) return locByProvince.get(nav.provinceId)?.id
    if (level === 'city' && nav.cityId) return locByCity.get(nav.cityId)?.id
    if (level === 'region' && nav.regionId) return locByRegion.get(nav.regionId)?.id
    if (level === 'dealer' && nav.dealerId) return locByDealer.get(nav.dealerId)?.id
    return undefined
  }, [level, nav, nationalLocationId, locByProvince, locByCity, locByRegion, locByDealer])

  const breadcrumb = useMemo(() => {
    const items: { label: string; nav: Nav }[] = [{ label: 'Canada', nav: {} }]
    if (province) items.push({ label: province.code, nav: { provinceId: province.id } })
    if (city) items.push({ label: city.name, nav: { provinceId: province!.id, cityId: city.id } })
    if (region)
      items.push({
        label: region.name,
        nav: { provinceId: province!.id, cityId: city!.id, regionId: region.id },
      })
    if (dealer)
      items.push({
        label: dealer.name,
        nav: {
          provinceId: province!.id,
          cityId: city!.id,
          regionId: region!.id,
          dealerId: dealer.id,
        },
      })
    return items
  }, [province, city, region, dealer])

  const childCards = useMemo(() => {
    if (level === 'national') {
      return provinces.map((p) => {
        const cityCount = cities.filter((c) => c.province_id === p.id).length
        return {
          key: p.id,
          label: `${p.code} — ${p.name}`,
          sub: cityCount > 0 ? `Eyalet · ${cityCount} şehir` : 'Eyalet · şehir tanımlı değil',
          total: totalAtLocation(locByProvince.get(p.id)?.id),
          onClick: () => setNav({ provinceId: p.id }),
        }
      })
    }
    if (level === 'province' && nav.provinceId) {
      return cities
        .filter((c) => c.province_id === nav.provinceId)
        .map((c) => {
          const regionCount = regions.filter((r) => r.city_id === c.id).length
          return {
            key: c.id,
            label: c.name,
            sub: regionCount > 0 ? `Şehir · ${regionCount} iç bölge` : 'Şehir · iç bölge yok',
            total: totalAtLocation(locByCity.get(c.id)?.id),
            onClick: () => setNav({ provinceId: nav.provinceId, cityId: c.id }),
          }
        })
    }
    if (level === 'city' && nav.cityId) {
      return regions
        .filter((r) => r.city_id === nav.cityId)
        .map((r) => {
          const dealerCount = dealers.filter((d) => d.inventory_region_id === r.id).length
          return {
            key: r.id,
            label: r.name,
            sub: dealerCount > 0 ? `İç bölge · ${dealerCount} bayi` : 'İç bölge · bayi atanmadı',
            total: totalAtLocation(locByRegion.get(r.id)?.id),
            onClick: () =>
              setNav({ provinceId: nav.provinceId, cityId: nav.cityId, regionId: r.id }),
          }
        })
    }
    if (level === 'region' && nav.regionId) {
      return dealers
        .filter((d) => d.inventory_region_id === nav.regionId)
        .map((d) => ({
          key: d.id,
          label: d.name,
          sub: 'Bayi · kurulum buradan düşer',
          total: totalAtLocation(locByDealer.get(d.id)?.id),
          onClick: () =>
            setNav({
              provinceId: nav.provinceId,
              cityId: nav.cityId,
              regionId: nav.regionId,
              dealerId: d.id,
            }),
        }))
    }
    return []
  }, [level, nav, provinces, cities, regions, dealers, locByProvince, locByCity, locByRegion, locByDealer, cameras, balanceMap])

  const upstreamLocationId = useMemo(() => {
    if (level === 'province') return nationalLocationId ?? undefined
    if (level === 'city' && nav.provinceId) return locByProvince.get(nav.provinceId)?.id
    if (level === 'region' && nav.cityId) return locByCity.get(nav.cityId)?.id
    if (level === 'dealer' && nav.regionId) return locByRegion.get(nav.regionId)?.id
    return undefined
  }, [level, nav, nationalLocationId, locByProvince, locByCity, locByRegion])

  const downstreamTargets = useMemo(() => {
    if (level === 'national') {
      return provinces
        .map((p) => ({ id: locByProvince.get(p.id)?.id, label: p.code }))
        .filter((x) => x.id) as { id: string; label: string }[]
    }
    if (level === 'province') {
      return cities
        .filter((c) => c.province_id === nav.provinceId)
        .map((c) => ({ id: locByCity.get(c.id)?.id!, label: c.name }))
        .filter((x) => x.id)
    }
    if (level === 'city') {
      return regions
        .filter((r) => r.city_id === nav.cityId)
        .map((r) => ({ id: locByRegion.get(r.id)?.id!, label: r.name }))
        .filter((x) => x.id)
    }
    if (level === 'region') {
      return dealers
        .filter((d) => d.inventory_region_id === nav.regionId)
        .map((d) => ({ id: locByDealer.get(d.id)?.id!, label: d.name }))
        .filter((x) => x.id)
    }
    return []
  }, [level, nav, provinces, cities, regions, dealers, locByProvince, locByCity, locByRegion, locByDealer])

  const pricingScopeOptions = useMemo(() => {
    const opts: { value: string; label: string; scopeType: string; scopeId: string | null }[] = [
      { value: 'national:', label: 'Canada (National)', scopeType: 'national', scopeId: null },
    ]
    for (const p of provinces) {
      opts.push({ value: `province:${p.id}`, label: `${p.code} — Province`, scopeType: 'province', scopeId: p.id })
    }
    for (const c of cities) {
      const pc = c.inventory_provinces?.code ?? provinces.find((p) => p.id === c.province_id)?.code ?? ''
      opts.push({ value: `city:${c.id}`, label: `${pc} / ${c.name}`, scopeType: 'city', scopeId: c.id })
    }
    for (const r of regions) {
      const cn = r.inventory_cities?.name ?? cities.find((c) => c.id === r.city_id)?.name ?? ''
      opts.push({ value: `region:${r.id}`, label: `${cn} / ${r.name}`, scopeType: 'region', scopeId: r.id })
    }
    for (const d of dealers) {
      opts.push({ value: `dealer:${d.id}`, label: `Dealer — ${d.name}`, scopeType: 'dealer', scopeId: d.id })
    }
    return opts
  }, [provinces, cities, regions, dealers])

  const stockRows = cameras
    .map((c) => ({ ...c, qty: getQty(currentLocationId, c.id) }))
    .filter((r) => r.qty !== 0 || level === 'dealer')

  const guide = levelGuide(level)

  const quickPaths = useMemo(() => {
    const paths: { label: string; nav: Nav }[] = []
    const bc = provinces.find((p) => p.code === 'BC')
    if (!bc) return paths
    paths.push({ label: 'BC', nav: { provinceId: bc.id } })

    const van = cities.find(
      (c) => c.province_id === bc.id && (c.code === 'VAN' || c.name.toLowerCase() === 'vancouver')
    )
    if (van) {
      paths.push({ label: 'BC → Vancouver', nav: { provinceId: bc.id, cityId: van.id } })
      const east = regions.find(
        (r) => r.city_id === van.id && (r.code === 'EAST' || r.name.toLowerCase().includes('east'))
      )
      if (east) {
        paths.push({
          label: 'BC → Vancouver → East Vancouver',
          nav: { provinceId: bc.id, cityId: van.id, regionId: east.id },
        })
      }
    }
    return paths
  }, [provinces, cities, regions])

  const childSectionTitle = useMemo(() => {
    if (level === 'national') return 'Eyaletler — birine tıklayın'
    if (level === 'province') return 'Şehirler — birine tıklayın'
    if (level === 'city') return 'İç bölgeler — birine tıklayın'
    if (level === 'region') return 'Bayiler — birine tıklayın'
    return ''
  }, [level])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-gray-800 pb-3">
        {(
          [
            { id: 'dashboard' as const, label: 'Dashboard' },
            {
              id: 'alerts' as const,
              label: summary.warningCount > 0 ? `Alerts (${summary.warningCount})` : 'Alerts',
            },
            { id: 'stock' as const, label: 'Stok ağacı' },
            { id: 'specialists' as const, label: 'Specialists' },
            { id: 'movements' as const, label: 'Movements' },
            { id: 'pricing' as const, label: 'Pricing' },
            { id: 'setup' as const, label: 'Setup geography' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id ? 'bg-[#C27E00] text-white' : 'text-zinc-600 dark:text-gray-400 hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === 'err'
              ? 'border-red-800/50 bg-red-950/30 text-red-200'
              : 'border-green-800/50 bg-green-950/30 text-green-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {tab === 'dashboard' && (
        <InventoryDashboardPanel
          summary={summary}
          alerts={alerts}
          provinces={provinces}
          cities={cities}
          regions={regions}
          dealers={dealers}
          locations={locations}
          balances={balances}
          cameras={cameras}
          movements={movements}
          onOpenAlerts={() => setTab('alerts')}
          onOpenStock={() => setTab('stock')}
        />
      )}

      {tab === 'alerts' && (
        <InventoryAlertsPanel
          alerts={alerts}
          summary={summary}
          customRules={customRules}
          provinces={provinces}
          cities={cities}
          regions={regions}
          dealers={dealers}
          locations={locations}
          cameras={cameras}
        />
      )}

      {tab === 'stock' && (
        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-4">
            {/* Flow pipeline */}
            <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 bg-zinc-50/80 dark:bg-white/[0.02]">
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Stok hiyerarşisi</p>
              <div className="flex flex-wrap items-center gap-1 text-sm">
                {STOCK_FLOW.map((step, i) => {
                  const stepLevel = step.key as InventoryTreeLevel
                  const isPast =
                    STOCK_FLOW.findIndex((s) => s.key === level) >= i
                  const isCurrent = stepLevel === level
                  return (
                    <span key={step.key} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isCurrent
                            ? 'bg-[#C27E00] text-white'
                            : isPast
                              ? 'bg-[#C27E00]/20 text-[#C27E00]'
                              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {step.tr}
                      </span>
                    </span>
                  )
                })}
              </div>
              {quickPaths.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-gray-800">
                  <p className="text-xs text-zinc-500 mb-2">Hızlı git:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickPaths.map((qp) => (
                      <button
                        key={qp.label}
                        type="button"
                        onClick={() => setNav(qp.nav)}
                        className="rounded-md border border-[#C27E00]/40 bg-[#C27E00]/10 px-2.5 py-1 text-xs font-medium text-[#C27E00] hover:bg-[#C27E00]/20"
                      >
                        {qp.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Breadcrumb */}
            <nav className="flex flex-wrap items-center gap-1 text-sm rounded-lg bg-zinc-100 dark:bg-white/5 px-3 py-2">
              <span className="text-xs text-zinc-500 mr-1">Konum:</span>
              {breadcrumb.map((item, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-4 w-4 text-zinc-500" />}
                  <button
                    type="button"
                    onClick={() => setNav(item.nav)}
                    className={`hover:text-[#C27E00] ${
                      i === breadcrumb.length - 1
                        ? 'font-semibold text-zinc-900 dark:text-white'
                        : 'text-zinc-500 dark:text-gray-400'
                    }`}
                  >
                    {item.label}
                  </button>
                </span>
              ))}
            </nav>

            {/* Level guide */}
            <div className="rounded-xl border border-blue-900/30 bg-blue-950/20 p-4 space-y-2">
              <h3 className="font-semibold text-blue-100 text-sm">{guide.title}</h3>
              <ul className="text-xs text-blue-100/85 space-y-1.5 list-disc list-inside">
                <li><strong>Neredesiniz:</strong> {guide.where}</li>
                <li><strong>Ne yapın:</strong> {guide.click}</li>
                <li><strong>Stok işlemi:</strong> {guide.stock}</li>
              </ul>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#C27E00]" />
                  Eldeki stok (bu seviyede)
                </h3>
                <span className={`text-lg tabular-nums font-bold ${qtyClass(totalAtLocation(currentLocationId))}`}>
                  {totalAtLocation(currentLocationId)} adet
                </span>
              </div>
              {stockRows.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Bu seviyede kayıtlı stok yok.
                  {level === 'national' && ' Sağ panelden Receipt ile giriş yapın.'}
                  {level !== 'national' && level !== 'dealer' && ' Üst seviyeden Allocate down ile stok gönderin.'}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-zinc-500">
                      <th className="py-1">Kamera modeli</th>
                      <th className="py-1 text-right">Adet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.map((r) => (
                      <tr key={r.id}>
                        <td className="py-1">{r.name}</td>
                        <td className={`py-1 text-right tabular-nums ${qtyClass(r.qty)}`}>{r.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {level !== 'dealer' && (
              <div>
                <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">{childSectionTitle}</h4>
                <p className="text-xs text-zinc-500 mb-3">Karttaki sayı = o bölgedeki toplam stok. Sıfır normal — henüz allocate edilmemiş olabilir.</p>
                {childCards.length === 0 ? (
                  <div className="text-sm text-zinc-500 rounded-lg border border-dashed border-amber-700/40 bg-amber-950/15 p-4 space-y-2">
                    {level === 'region' && (
                      <>
                        <p><strong>Bayi yok.</strong> System Management → Dealers → bayiyi düzenleyin → Inventory inner region seçin (ör. East Vancouver).</p>
                      </>
                    )}
                    {level === 'city' && (
                      <p><strong>İç bölge yok.</strong> Setup geography sekmesinden ekleyin (East Vancouver zaten varsa tekrar eklemeyin).</p>
                    )}
                    {level === 'province' && (
                      <p><strong>Şehir yok.</strong> Setup geography sekmesinden ekleyin (Vancouver zaten varsa BC kartına tıklayın).</p>
                    )}
                    {level === 'national' && <p>Veri yüklenemedi.</p>}
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {childCards.map((card) => (
                      <button
                        key={card.key}
                        type="button"
                        onClick={card.onClick}
                        className="group flex items-center justify-between rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-50 dark:bg-white/[0.03] px-4 py-3 text-left hover:border-[#C27E00]/50 hover:bg-[#C27E00]/5 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-zinc-900 dark:text-white truncate">{card.label}</p>
                          <p className="text-xs text-zinc-500">{card.sub}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className={`tabular-nums text-sm ${qtyClass(card.total)}`}>{card.total}</span>
                          <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-[#C27E00]" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {level === 'dealer' && dealer && (
              <form
                className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  runAction(() => postDealerToSpecialistTransfer(new FormData(e.currentTarget)))
                }}
              >
                <h4 className="font-medium text-zinc-900 dark:text-white">Transfer to specialist</h4>
                <input type="hidden" name="dealer_id" value={dealer.id} />
                <select name="specialist_profile_id" required className={`${inputClass} w-full`}>
                  <option value="">Specialist…</option>
                  {specialists.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name ?? s.id.slice(0, 8)}</option>
                  ))}
                </select>
                <select name="camera_model_id" required className={`${inputClass} w-full`}>
                  <option value="">Camera model…</option>
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input name="quantity" type="number" min={1} defaultValue={1} required className={`${inputClass} w-full`} />
                <button type="submit" disabled={pending} className={btnPrimary}>Transfer</button>
              </form>
            )}

            {alerts.length > 0 && level === 'national' && (
              <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 space-y-2">
                <h4 className="text-sm font-medium text-amber-200">Alerts</h4>
                {alerts.slice(0, 5).map((a, i) => (
                  <p key={i} className="text-xs text-amber-100/80">
                    <strong>{a.title}</strong> — {a.detail}
                  </p>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-zinc-200 dark:border-gray-800 p-3 text-xs text-zinc-500 space-y-1">
              <p className="font-medium text-zinc-700 dark:text-gray-300">Sağ panel — stok işlemleri</p>
              <p><strong>Receipt:</strong> Yeni stok girişi (genelde Kanada seviyesinde)</p>
              <p><strong>Allocate down:</strong> Alt seviyeye aktar (Kanada→BC→Vancouver→…)</p>
              <p><strong>Adjustment:</strong> Manuel +/− düzeltme</p>
            </div>
            {currentLocationId && (
              <>
                {(level === 'national' || level === 'province') && (
                  <StockForm
                    title="Receipt — stok girişi"
                    help="Yeni kameraları bu seviyeye ekler."
                    cameras={cameras}
                    onSubmit={(fd) => runAction(() => postInventoryReceipt(fd))}
                    pending={pending}
                  >
                    <input type="hidden" name="to_location_id" value={currentLocationId} />
                  </StockForm>
                )}

                {downstreamTargets.length > 0 && (
                  <StockForm
                    title={`Allocate down — alta dağıt (${downstreamTargets.length})`}
                    help={`Stoku bir alt seviyeye gönderir. Örn: ${guide.action}`}
                    cameras={cameras}
                    onSubmit={(fd) => runAction(() => postInventoryAllocation(fd))}
                    pending={pending}
                  >
                    <input type="hidden" name="from_location_id" value={currentLocationId} />
                    <select name="to_location_id" required className={`${inputClass} w-full`}>
                      <option value="">Hedef seçin…</option>
                      {downstreamTargets.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </StockForm>
                )}

                {downstreamTargets.length === 0 && level !== 'dealer' && level !== 'national' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 rounded-lg border border-amber-800/30 p-3">
                    Alta allocate edilecek hedef yok. Önce alt seviyeyi oluşturun veya kartlardan drill-down yapın.
                  </p>
                )}

                <StockForm
                  title="Adjustment — manuel düzeltme"
                  help="Pozitif = ekle, negatif = çıkar (ör. -2)"
                  cameras={cameras}
                  showDelta
                  onSubmit={(fd) => runAction(() => postInventoryAdjustment(fd))}
                  pending={pending}
                >
                  <input type="hidden" name="location_id" value={currentLocationId} />
                </StockForm>

                {upstreamLocationId && level !== 'national' && (
                  <StockForm
                    title="Return — üst seviyeye iade"
                    help="Stoku bir üst kata geri gönderir."
                    cameras={cameras}
                    submitLabel="İade et"
                    onSubmit={(fd) => runAction(() => postInventoryReturn(fd))}
                    pending={pending}
                  >
                    <input type="hidden" name="from_location_id" value={currentLocationId} />
                    <input type="hidden" name="to_location_id" value={upstreamLocationId} />
                  </StockForm>
                )}

                {level === 'dealer' && (
                  <form
                    className="rounded-lg border border-zinc-200 dark:border-gray-800 p-3 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      runAction(() => upsertInventoryThreshold(new FormData(e.currentTarget)))
                    }}
                  >
                    <p className="text-xs font-medium uppercase text-zinc-500">Low-stock threshold</p>
                    <input type="hidden" name="location_id" value={currentLocationId} />
                    <select name="camera_model_id" required className={`${inputClass} w-full`}>
                      <option value="">Model…</option>
                      {cameras.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <input name="min_qty" type="number" min={0} defaultValue={2} className={`${inputClass} w-full`} />
                    <button type="submit" disabled={pending} className={`${btnSecondary} w-full`}>Set min</button>
                  </form>
                )}
              </>
            )}
          </aside>
        </div>
      )}

      {tab === 'specialists' && (
        <InventorySpecialistsPanel
          specialistStock={specialistStock}
          dealers={dealers}
          cameras={cameras}
        />
      )}

      {tab === 'movements' && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-gray-800">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-white/5 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">From → To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-500">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{m.movement_type}</td>
                  <td className="px-3 py-2">{m.camera_models?.name}</td>
                  <td className="px-3 py-2 tabular-nums">{m.quantity}</td>
                  <td className="px-3 py-2 text-xs">
                    {m.from_loc?.label ?? '—'} → {m.to_loc?.label ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'pricing' && (
        <PricingPanel
          cameras={cameras}
          pricingRules={pricingRules}
          scopeOptions={pricingScopeOptions}
          onSubmit={(fd) => runAction(() => upsertInventoryPricingRule(fd))}
          pending={pending}
        />
      )}

      {tab === 'setup' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-5">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Current geography</h3>
            <p className="text-xs text-zinc-500 mb-4">
              BC / Vancouver and sample inner regions may already exist from migration seed. Use Stock tree to browse; only add missing cities or regions here.
            </p>
            {provinces.length === 0 ? (
              <p className="text-sm text-zinc-500">No provinces loaded.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {provinces.map((p) => {
                  const provCities = cities.filter((c) => c.province_id === p.id)
                  return (
                    <li key={p.id}>
                      <p className="font-medium text-zinc-900 dark:text-white">{p.code} — {p.name}</p>
                      {provCities.length === 0 ? (
                        <p className="text-xs text-zinc-500 ml-3 mt-1">No cities yet</p>
                      ) : (
                        <ul className="ml-3 mt-1 space-y-2 border-l border-zinc-200 dark:border-gray-800 pl-3">
                          {provCities.map((c) => {
                            const inner = regions.filter((r) => r.city_id === c.id)
                            return (
                              <li key={c.id}>
                                <p className="text-zinc-700 dark:text-gray-300">
                                  {c.name} <span className="text-zinc-500">({c.code})</span>
                                </p>
                                {inner.length > 0 ? (
                                  <ul className="text-xs text-zinc-500 ml-2 mt-0.5 space-y-0.5">
                                    {inner.map((r) => (
                                      <li key={r.id}>↳ {r.name} ({r.code})</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-zinc-500 ml-2">No inner regions</p>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
          <form
            className="rounded-xl border border-zinc-200 dark:border-gray-800 p-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              runAction(() => createInventoryCity(new FormData(e.currentTarget)))
            }}
          >
            <h3 className="font-semibold flex items-center gap-2 text-zinc-900 dark:text-white">
              <MapPin className="h-4 w-4" /> Add city
            </h3>
            <p className="text-xs text-zinc-500">Canada → Province → <strong>City</strong> → Inner region → Dealer</p>
            <select name="province_id" required className={`${inputClass} w-full`}>
              <option value="">Province…</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
            <input name="code" placeholder="Code (e.g. SRY for Surrey)" required className={`${inputClass} w-full`} />
            <input name="name" placeholder="Name (e.g. Surrey)" required className={`${inputClass} w-full`} />
            <button type="submit" disabled={pending} className={btnPrimary}>Create city</button>
          </form>

          <form
            className="rounded-xl border border-zinc-200 dark:border-gray-800 p-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              runAction(() => createInventoryRegion(new FormData(e.currentTarget)))
            }}
          >
            <h3 className="font-semibold text-zinc-900 dark:text-white">Add inner region</h3>
            {cities.length === 0 ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                No cities yet. Vancouver may already exist — refresh the page. Otherwise add a city first.
              </p>
            ) : (
              <select name="city_id" required className={`${inputClass} w-full`}>
                <option value="">City…</option>
                {cities.map((c) => {
                  const pc = c.inventory_provinces?.code ?? provinces.find((p) => p.id === c.province_id)?.code
                  return (
                    <option key={c.id} value={c.id}>{pc} / {c.name}</option>
                  )
                })}
              </select>
            )}
            <input name="code" placeholder="Code (e.g. EAST)" required className={`${inputClass} w-full`} />
            <input name="name" placeholder="Name (e.g. East Vancouver)" required className={`${inputClass} w-full`} />
            <button type="submit" disabled={pending || cities.length === 0} className={btnPrimary}>
              Create inner region
            </button>
          </form>

          <div className="md:col-span-2 rounded-xl border border-red-900/40 bg-red-950/20 p-5">
            <h3 className="font-semibold text-red-200 mb-2">Reset ledger</h3>
            <button
              type="button"
              disabled={pending}
              className="rounded-md bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-600"
              onClick={() => {
                if (!confirm('Clear all inventory movements?')) return
                runAction(() => resetInventoryV2Data())
              }}
            >
              Reset movements
            </button>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StockForm({
  title,
  help,
  children,
  cameras,
  onSubmit,
  pending,
  showDelta,
  submitLabel,
}: {
  title: string
  help?: string
  children: React.ReactNode
  cameras: Camera[]
  onSubmit: (fd: FormData) => void
  pending: boolean
  showDelta?: boolean
  submitLabel?: string
}) {
  return (
    <form
      className="rounded-lg border border-zinc-200 dark:border-gray-800 p-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(new FormData(e.currentTarget))
      }}
    >
      <p className="text-xs font-medium text-zinc-900 dark:text-white">{title}</p>
      {help && <p className="text-[11px] text-zinc-500 leading-snug">{help}</p>}
      {children}
      <select name="camera_model_id" required className={`${inputClass} w-full`}>
        <option value="">Kamera modeli…</option>
        {cameras.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {showDelta ? (
        <input name="quantity_delta" type="number" required placeholder="+5 veya -2" className={`${inputClass} w-full`} />
      ) : (
        <input name="quantity" type="number" min={1} defaultValue={1} required className={`${inputClass} w-full`} />
      )}
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {submitLabel ?? 'Kaydet'}
      </button>
    </form>
  )
}

function PricingPanel({
  cameras,
  pricingRules,
  scopeOptions,
  onSubmit,
  pending,
}: {
  cameras: Camera[]
  pricingRules: PricingRule[]
  scopeOptions: { value: string; label: string; scopeType: string; scopeId: string | null }[]
  onSubmit: (fd: FormData) => void
  pending: boolean
}) {
  const [scopeKey, setScopeKey] = useState(scopeOptions[0]?.value ?? 'national:')
  const selected = scopeOptions.find((o) => o.value === scopeKey) ?? scopeOptions[0]
  const rulesForScope = pricingRules.filter(
    (r) => r.scope_type === selected?.scopeType && (r.scope_id ?? null) === (selected?.scopeId ?? null)
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">Cascade: dealer → inner region → city → province → Canada</p>
      <select value={scopeKey} onChange={(e) => setScopeKey(e.target.value)} className={inputClass}>
        {scopeOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-white/5 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left">Model</th>
              <th className="px-3 py-2 text-left">Price CAD</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {cameras.map((c) => {
              const rule = rulesForScope.find((r) => r.service_type === 'installation' && r.camera_model_id === c.id)
              return (
                <tr key={c.id} className="border-t border-zinc-200 dark:border-gray-800">
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{rule ? `$${rule.price_cad}` : '—'}</td>
                  <td className="px-3 py-2">
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        onSubmit(new FormData(e.currentTarget))
                      }}
                    >
                      <input type="hidden" name="scope_type" value={selected?.scopeType ?? 'national'} />
                      {selected?.scopeId && <input type="hidden" name="scope_id" value={selected.scopeId} />}
                      <input type="hidden" name="camera_model_id" value={c.id} />
                      <input type="hidden" name="service_type" value="installation" />
                      <input name="price_cad" type="number" min={0} step={0.01} defaultValue={rule?.price_cad ?? ''} required className={`${inputClass} w-24`} />
                      <button type="submit" disabled={pending} className={btnSecondary}>Save</button>
                    </form>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
