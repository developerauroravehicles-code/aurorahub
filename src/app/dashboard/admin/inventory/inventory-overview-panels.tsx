'use client'

import { AlertTriangle, Info, Package, TrendingDown } from 'lucide-react'
import type { InventoryStockAlert, InventoryStockSummary } from '@/lib/inventory-stock-alerts'
import type { InventoryAlertRule } from '@/lib/inventory-alert-rules'
import { InventoryCustomAlertsSection } from './inventory-custom-alerts-section'

type Movement = {
  id: string
  movement_type: string
  quantity: number
  created_at: string
  camera_models: { name: string } | null
  from_loc: { label: string } | null
  to_loc: { label: string } | null
}

type Province = { id: string; code: string; name: string }
type City = { id: string; name: string; province_id: string }
type Region = { id: string; name: string; city_id: string; province_id: string }
type Dealer = { id: string; name: string; inventory_region_id: string | null }
type Location = { id: string; location_type: string; label: string; province_id: string | null; city_id: string | null; dealer_id: string | null }
type Balance = { location_id: string; camera_model_id: string; quantity: number }
type Camera = { id: string; name: string }

function StatCard({
  label,
  value,
  warn,
  sub,
}: {
  label: string
  value: string | number
  warn?: boolean
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-gray-800 bg-zinc-50/80 dark:bg-white/[0.03] p-4">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${warn ? 'text-amber-400' : 'text-zinc-900 dark:text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}

export function InventoryDashboardPanel({
  summary,
  alerts,
  provinces,
  cities,
  regions,
  dealers,
  locations,
  balances,
  cameras,
  movements,
  onOpenAlerts,
  onOpenStock,
}: {
  summary: InventoryStockSummary
  alerts: InventoryStockAlert[]
  provinces: Province[]
  cities: City[]
  regions: Region[]
  dealers: Dealer[]
  locations: Location[]
  balances: Balance[]
  cameras: Camera[]
  movements: Movement[]
  onOpenAlerts: () => void
  onOpenStock: () => void
}) {
  const nationalLoc = locations.find((l) => l.location_type === 'national')
  const dealerLocs = locations.filter((l) => l.location_type === 'dealer')

  const balanceMap = new Map<string, number>()
  for (const b of balances) balanceMap.set(`${b.location_id}:${b.camera_model_id}`, b.quantity)

  const nationalTotal = nationalLoc
    ? cameras.reduce((s, c) => s + (balanceMap.get(`${nationalLoc.id}:${c.id}`) ?? 0), 0)
    : summary.nationalQtyTotal

  const dealerStockRows = dealerLocs
    .map((loc) => {
      const total = cameras.reduce((s, c) => s + (balanceMap.get(`${loc.id}:${c.id}`) ?? 0), 0)
      const dealer = dealers.find((d) => d.id === loc.dealer_id)
      return { dealer: dealer?.name ?? loc.dealer_id ?? '?', total }
    })
    .filter((r) => r.total !== 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  const geoRows = provinces.map((p) => {
    const pCities = cities.filter((c) => c.province_id === p.id)
    const pCityIds = new Set(pCities.map((c) => c.id))
    const pRegions = regions.filter((r) => pCityIds.has(r.city_id))
    const pDealers = dealers.filter((d) =>
      pRegions.some((r) => r.id === d.inventory_region_id)
    )
    return { code: p.code, cities: pCities.length, regions: pRegions.length, dealers: pDealers.length }
  })

  const recentMovements = movements.slice(0, 8)
  const warningAlerts = alerts.filter((a) => a.level === 'warning')

  return (
    <div className="space-y-6">
      {warningAlerts.length > 0 && (
        <button
          type="button"
          onClick={onOpenAlerts}
          className="w-full rounded-xl border border-amber-800/50 bg-amber-950/25 p-4 text-left hover:bg-amber-950/35 transition-colors"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-medium text-amber-100">{warningAlerts.length} envanter uyarısı</p>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Aurora Manager&apos;a e-posta + bildirim gönderilir (24 saatte bir, aynı uyarı seti için).
              </p>
            </div>
          </div>
        </button>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Kanada stoku" value={nationalTotal} sub="National receipt" />
        <StatCard label="Bayi stoku (toplam)" value={summary.dealerQtyTotal} warn={summary.dealerQtyTotal < 0} />
        <StatCard label="Uyarılar" value={summary.warningCount} warn={summary.warningCount > 0} sub={`${summary.infoCount} bilgi`} />
        <StatCard label="Negatif satır" value={summary.shortSkuLines} warn={summary.shortSkuLines > 0} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-[#C27E00]" /> Coğrafya özeti
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-zinc-500">
                <th className="pb-2">Eyalet</th>
                <th className="pb-2 text-right">Şehir</th>
                <th className="pb-2 text-right">İç bölge</th>
                <th className="pb-2 text-right">Bayi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
              {geoRows.map((r) => (
                <tr key={r.code}>
                  <td className="py-1.5 font-medium">{r.code}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.cities}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.regions}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.dealers}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={onOpenStock} className="mt-3 text-xs text-[#C27E00] hover:underline">
            Stok ağacına git →
          </button>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-[#C27E00]" /> Bayi stokları (≠0)
          </h3>
          {dealerStockRows.length === 0 ? (
            <p className="text-sm text-zinc-500">Henüz bayi stoğu yok.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {dealerStockRows.map((r) => (
                <li key={r.dealer} className="flex justify-between">
                  <span className="truncate pr-2">{r.dealer}</span>
                  <span className={`tabular-nums ${r.total < 0 ? 'text-red-400' : ''}`}>{r.total}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4">
        <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">Son hareketler</h3>
        {recentMovements.length === 0 ? (
          <p className="text-sm text-zinc-500">Henüz hareket yok.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-zinc-500 uppercase">
                <th className="pb-2">Tarih</th>
                <th className="pb-2">Tip</th>
                <th className="pb-2">Model</th>
                <th className="pb-2 text-right">Adet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
              {recentMovements.map((m) => (
                <tr key={m.id}>
                  <td className="py-1.5 text-zinc-500">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="py-1.5">{m.movement_type}</td>
                  <td className="py-1.5">{m.camera_models?.name ?? '—'}</td>
                  <td className="py-1.5 text-right tabular-nums">{m.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export function InventoryAlertsPanel({
  alerts,
  summary,
  customRules,
  provinces,
  cities,
  regions,
  dealers,
  locations,
  cameras,
}: {
  alerts: InventoryStockAlert[]
  summary: InventoryStockSummary
  customRules: InventoryAlertRule[]
  provinces: Province[]
  cities: City[]
  regions: Region[]
  dealers: Dealer[]
  locations: Location[]
  cameras: Camera[]
}) {
  const warnings = alerts.filter((a) => a.level === 'warning')
  const infos = alerts.filter((a) => a.level === 'info')
  const systemWarnings = warnings.filter((a) => a.source !== 'custom')
  const customWarnings = warnings.filter((a) => a.source === 'custom')
  const customInfos = infos.filter((a) => a.source === 'custom')
  const systemInfos = infos.filter((a) => a.source === 'system')

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 text-sm text-zinc-600 dark:text-gray-400">
        <p>
          <strong className="text-zinc-900 dark:text-white">Otomatik bildirim:</strong> Uyarı (warning) varsa Aurora
          Manager rolündeki kullanıcılara uygulama içi bildirim + e-posta gider. Aynı uyarı seti 24 saatte bir kez
          tekrarlanır.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Uyarı" value={summary.warningCount} warn={summary.warningCount > 0} />
        <StatCard label="Bilgi" value={summary.infoCount} />
        <StatCard label="Özel kural" value={customRules.filter((r) => r.is_active).length} />
        <StatCard label="Min. altı" value={summary.belowMinLines} warn={summary.belowMinLines > 0} />
      </div>

      <InventoryCustomAlertsSection
        rules={customRules}
        provinces={provinces}
        cities={cities}
        regions={regions}
        dealers={dealers}
        cameras={cameras}
      />

      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" /> Uyarılar ({warnings.length})
        </h3>
        {warnings.length === 0 ? (
          <p className="text-sm text-zinc-500 rounded-lg border border-dashed border-zinc-300 dark:border-gray-700 p-4">
            Aktif uyarı yok.
          </p>
        ) : (
          <ul className="space-y-2">
            {customWarnings.length > 0 && (
              <li className="text-[10px] uppercase tracking-wider text-zinc-500 px-1">Özel kurallar</li>
            )}
            {customWarnings.map((a, i) => (
              <li
                key={`c-w-${i}`}
                className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-sm"
              >
                <p className="font-medium text-amber-100">{a.title}</p>
                <p className="text-xs text-amber-200/75 mt-1">{a.detail}</p>
              </li>
            ))}
            {systemWarnings.length > 0 && customWarnings.length > 0 && (
              <li className="text-[10px] uppercase tracking-wider text-zinc-500 px-1 pt-2">Sistem</li>
            )}
            {systemWarnings.map((a, i) => (
              <li
                key={`s-w-${i}`}
                className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-sm"
              >
                <p className="font-medium text-amber-100">{a.title}</p>
                <p className="text-xs text-amber-200/75 mt-1">{a.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-400" /> Bilgi ({infos.length})
        </h3>
        {infos.length === 0 ? (
          <p className="text-sm text-zinc-500">Bilgi alerti yok.</p>
        ) : (
          <ul className="space-y-2">
            {[...customInfos, ...systemInfos].map((a, i) => (
              <li
                key={`info-${i}`}
                className="rounded-lg border border-zinc-300 dark:border-gray-700 bg-white/[0.03] px-4 py-3 text-sm"
              >
                <p className="font-medium text-zinc-900 dark:text-white">{a.title}</p>
                <p className="text-xs text-zinc-500 mt-1">{a.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
