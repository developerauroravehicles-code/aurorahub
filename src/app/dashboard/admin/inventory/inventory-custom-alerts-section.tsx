'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Bell, ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { InventoryAlertRule } from '@/lib/inventory-alert-rules'
import {
  formatAlertRuleGeoPath,
  RULE_TYPE_LABELS,
  type InventoryAlertLocationScope,
  type InventoryAlertRuleType,
} from '@/lib/inventory-alert-rules'
import {
  createInventoryAlertRule,
  deleteInventoryAlertRule,
  toggleInventoryAlertRule,
} from './actions'

type Province = { id: string; code: string; name: string }
type City = { id: string; name: string; province_id: string }
type Region = { id: string; name: string; city_id: string; province_id: string }
type Dealer = { id: string; name: string; inventory_region_id: string | null }
type Camera = { id: string; name: string }

type ScopeChoice = InventoryAlertLocationScope | 'geo'

const inputClass =
  'rounded-lg border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/40 px-3 py-2 text-sm text-zinc-900 dark:text-white'
const btnPrimary =
  'rounded-lg bg-[#C27E00] px-3 py-2 text-sm font-medium text-white hover:bg-[#a86a00] disabled:opacity-50'
const btnSecondary =
  'rounded-lg border border-zinc-300 dark:border-gray-700 px-3 py-1.5 text-xs text-zinc-700 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-50'

function deriveGeoScope(provinceId: string, cityId: string, regionId: string, dealerId: string) {
  if (dealerId) {
    return { scope: 'dealer_one' as const, provinceId, cityId, regionId, dealerId }
  }
  if (regionId) return { scope: 'region' as const, provinceId, cityId, regionId }
  if (cityId) return { scope: 'city' as const, provinceId, cityId, regionId: '' }
  return { scope: 'province' as const, provinceId, cityId: '', regionId: '' }
}

export function InventoryCustomAlertsSection({
  rules,
  provinces,
  cities,
  regions,
  dealers,
  cameras,
}: {
  rules: InventoryAlertRule[]
  provinces: Province[]
  cities: City[]
  regions: Region[]
  dealers: Dealer[]
  cameras: Camera[]
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [scopeChoice, setScopeChoice] = useState<ScopeChoice>('any')
  const [provinceId, setProvinceId] = useState('')
  const [cityId, setCityId] = useState('')
  const [regionId, setRegionId] = useState('')
  const [dealerId, setDealerId] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    setCityId('')
    setRegionId('')
    setDealerId('')
  }, [provinceId])

  useEffect(() => {
    setRegionId('')
    setDealerId('')
  }, [cityId])

  useEffect(() => {
    setDealerId('')
  }, [regionId])

  const citiesInProvince = useMemo(
    () => cities.filter((c) => c.province_id === provinceId).sort((a, b) => a.name.localeCompare(b.name)),
    [cities, provinceId]
  )

  const regionsInCity = useMemo(
    () => regions.filter((r) => r.city_id === cityId).sort((a, b) => a.name.localeCompare(b.name)),
    [regions, cityId]
  )

  const dealersInRegion = useMemo(
    () =>
      dealers
        .filter((d) => d.inventory_region_id === regionId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [dealers, regionId]
  )

  const geoPreview = useMemo(() => {
    if (scopeChoice !== 'geo') return null
    const parts = ['Kanada']
    const p = provinces.find((x) => x.id === provinceId)
    if (p) parts.push(p.code)
    const c = cities.find((x) => x.id === cityId)
    if (c) parts.push(c.name)
    const r = regions.find((x) => x.id === regionId)
    if (r) parts.push(r.name)
    const d = dealers.find((x) => x.id === dealerId)
    if (d) parts.push(d.name)
    return parts.join(' → ')
  }, [scopeChoice, provinceId, cityId, regionId, dealerId, provinces, cities, regions, dealers])

  function runAction(fn: () => Promise<{ error?: string; success?: boolean }>) {
    startTransition(async () => {
      setMessage(null)
      const result = await fn()
      if (result.error) setMessage({ type: 'err', text: result.error })
      else setMessage({ type: 'ok', text: 'Kaydedildi.' })
    })
  }

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#C27E00]" /> Özel alert kuralları ({rules.length})
        </h3>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className={`${btnSecondary} inline-flex items-center gap-1.5`}
        >
          <Plus className="h-3.5 w-3.5" />
          {showForm ? 'Formu gizle' : 'Yeni kural'}
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        Konum için <strong>Kanada → Eyalet → Şehir → İç bölge → Bayi</strong> sırasıyla seçim yapın (ör.
        BC → Vancouver → East Vancouver → bayi adı).
      </p>

      {message && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            message.type === 'err'
              ? 'border-red-800/50 bg-red-950/30 text-red-200'
              : 'border-green-800/50 bg-green-950/30 text-green-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {showForm && (
        <form
          className="grid gap-3 md:grid-cols-2 rounded-lg border border-dashed border-zinc-300 dark:border-gray-700 p-4"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)

            if (scopeChoice === 'geo') {
              if (!provinceId) {
                setMessage({ type: 'err', text: 'Eyalet seçin (Kanada → BC …)' })
                return
              }
              const derived = deriveGeoScope(provinceId, cityId, regionId, dealerId)
              fd.set('location_scope', derived.scope)
              fd.set('province_id', derived.provinceId)
              if (derived.cityId) fd.set('city_id', derived.cityId)
              if (derived.regionId) fd.set('region_id', derived.regionId)
              if ('dealerId' in derived && derived.dealerId) fd.set('dealer_id', derived.dealerId)
            } else {
              fd.set('location_scope', scopeChoice)
            }

            runAction(() => createInventoryAlertRule(fd))
          }}
        >
          <label className="md:col-span-2 space-y-1">
            <span className="text-xs text-zinc-500">Kural adı</span>
            <input name="name" required placeholder="Örn. East Vancouver düşük stok" className={`${inputClass} w-full`} />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-zinc-500">Koşul</span>
            <select name="rule_type" required className={`${inputClass} w-full`}>
              {(Object.keys(RULE_TYPE_LABELS) as InventoryAlertRuleType[]).map((k) => (
                <option key={k} value={k}>
                  {RULE_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-zinc-500">Konum kapsamı</span>
            <select
              required
              value={scopeChoice}
              onChange={(e) => setScopeChoice(e.target.value as ScopeChoice)}
              className={`${inputClass} w-full`}
            >
              <option value="any">Tüm konumlar (ulusal + bayi)</option>
              <option value="national">Kanada (ulusal stok)</option>
              <option value="dealer">Tüm bayiler</option>
              <option value="geo">Coğrafya seç (Kanada → Eyalet → …)</option>
            </select>
          </label>

          {scopeChoice === 'geo' && (
            <div className="md:col-span-2 rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-50/50 dark:bg-white/[0.02] p-4 space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Coğrafya</p>

              <div className="flex flex-wrap items-center gap-1 text-sm text-zinc-700 dark:text-gray-300">
                <span className="font-medium text-zinc-900 dark:text-white">Kanada</span>
                {provinceId && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{provinces.find((p) => p.id === provinceId)?.code}</span>
                  </>
                )}
                {cityId && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{cities.find((c) => c.id === cityId)?.name}</span>
                  </>
                )}
                {regionId && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{regions.find((r) => r.id === regionId)?.name}</span>
                  </>
                )}
                {dealerId && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{dealers.find((d) => d.id === dealerId)?.name}</span>
                  </>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-xs text-zinc-500">1. Eyalet *</span>
                  <select
                    required
                    value={provinceId}
                    onChange={(e) => setProvinceId(e.target.value)}
                    className={`${inputClass} w-full`}
                  >
                    <option value="">Seçin…</option>
                    {provinces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-zinc-500">2. Şehir</span>
                  <select
                    value={cityId}
                    onChange={(e) => setCityId(e.target.value)}
                    disabled={!provinceId}
                    className={`${inputClass} w-full disabled:opacity-50`}
                  >
                    <option value="">Tüm şehirler (eyalet)</option>
                    {citiesInProvince.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-zinc-500">3. İç bölge</span>
                  <select
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                    disabled={!cityId}
                    className={`${inputClass} w-full disabled:opacity-50`}
                  >
                    <option value="">Tüm iç bölgeler (şehir)</option>
                    {regionsInCity.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-zinc-500">4. Bayi</span>
                  <select
                    value={dealerId}
                    onChange={(e) => setDealerId(e.target.value)}
                    disabled={!regionId}
                    className={`${inputClass} w-full disabled:opacity-50`}
                  >
                    <option value="">Tüm bayiler (iç bölge)</option>
                    {dealersInRegion.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {regionId && dealersInRegion.length === 0 && (
                <p className="text-xs text-amber-500/90">
                  Bu iç bölgede atanmış bayi yok. System Management&apos;tan bayiye bölge atayın.
                </p>
              )}

              {geoPreview && (
                <p className="text-xs text-zinc-500">
                  Seçilen yol: <span className="text-zinc-300">{geoPreview}</span>
                </p>
              )}
            </div>
          )}

          <label className="space-y-1">
            <span className="text-xs text-zinc-500">Kamera modeli</span>
            <select name="camera_model_id" className={`${inputClass} w-full`}>
              <option value="">Tüm modeller</option>
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-zinc-500">Eşik değeri</span>
            <input
              name="threshold_value"
              type="number"
              min={0}
              step="any"
              defaultValue={5}
              required
              className={`${inputClass} w-full`}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-zinc-500">Seviye</span>
            <select name="severity" className={`${inputClass} w-full`}>
              <option value="warning">Uyarı (warning)</option>
              <option value="info">Bilgi (info)</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-4 items-center md:col-span-2 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" name="notify_in_app" defaultChecked className="rounded" />
              Uygulama bildirimi
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" name="notify_email" defaultChecked className="rounded" />
              E-posta
            </label>
          </div>

          <div className="md:col-span-2">
            <button type="submit" disabled={pending} className={btnPrimary}>
              Kural oluştur
            </button>
          </div>
        </form>
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-zinc-500">Henüz özel kural yok. Yukarıdan yeni kural ekleyin.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-zinc-500 border-b border-zinc-200 dark:border-gray-800">
                <th className="py-2 pr-3">Ad</th>
                <th className="py-2 pr-3">Koşul</th>
                <th className="py-2 pr-3">Konum</th>
                <th className="py-2 pr-3 text-right">Eşik</th>
                <th className="py-2 pr-3">Bildirim</th>
                <th className="py-2 pr-3">Durum</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
              {rules.map((rule) => (
                <tr key={rule.id} className={!rule.is_active ? 'opacity-50' : undefined}>
                  <td className="py-2 pr-3 font-medium">{rule.name}</td>
                  <td className="py-2 pr-3 text-zinc-500">{RULE_TYPE_LABELS[rule.rule_type]}</td>
                  <td className="py-2 pr-3 text-zinc-500 text-xs">
                    {formatAlertRuleGeoPath(rule, provinces, cities, regions, dealers)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{rule.threshold_value}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-500">
                    {rule.notify_in_app && rule.notify_email
                      ? 'App + e-posta'
                      : rule.notify_in_app
                        ? 'App'
                        : rule.notify_email
                          ? 'E-posta'
                          : 'Yok'}
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        runAction(() => toggleInventoryAlertRule(rule.id, !rule.is_active))
                      }
                      className={`${btnSecondary} ${rule.is_active ? 'text-green-400' : ''}`}
                    >
                      {rule.is_active ? 'Aktif' : 'Pasif'}
                    </button>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`"${rule.name}" kuralını sil?`)) return
                        runAction(() => deleteInventoryAlertRule(rule.id))
                      }}
                      className="p-1.5 text-red-400 hover:bg-red-950/30 rounded"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
