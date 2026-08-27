'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Barcode, Plus, Trash2, Printer, ScanLine, Package, Layers } from 'lucide-react'
import type { BarcodeSettings } from '@/lib/inventory-barcodes'
import type { BarcodeTraceRow } from '@/lib/inventory-barcodes/trace'
import { generateQrDataUrl } from '@/lib/generate-qr-data-url'
import {
  saveBarcodeSettingsAction,
  createBarcodeSetTemplate,
  deleteBarcodeSetTemplate,
  generateUnitBarcodesAction,
  generateSetBarcodesAction,
  scanAssignBarcodeToDealer,
  scanAssignBarcodeToSpecialist,
  voidBarcodeAction,
  getBarcodeTraceEvents,
} from './inventory-barcode-actions'

type Camera = { id: string; name: string }
type Dealer = { id: string; name: string }
type Specialist = { id: string; full_name: string | null }

type SetTemplate = {
  id: string
  name: string
  code: string
  description: string | null
  items?: {
    id: string
    camera_model_id: string
    quantity: number
    camera_models?: { name: string } | null
  }[]
}

type GeneratedBarcode = { id: string; code: string; kind: string }

const inputClass =
  'rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]'
const btnPrimary =
  'rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white hover:bg-[#a06900] disabled:opacity-50'

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    generated: 'bg-zinc-500/20 text-zinc-400',
    at_dealer: 'bg-blue-500/20 text-blue-300',
    at_specialist: 'bg-purple-500/20 text-purple-300',
    consumed: 'bg-green-500/20 text-green-300',
    void: 'bg-red-500/20 text-red-300',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[status] ?? 'bg-zinc-500/20 text-zinc-400'}`}>
      {status}
    </span>
  )
}

export function InventoryBarcodePanel({
  settings,
  templates,
  registry,
  cameras,
  dealers,
  specialists,
}: {
  settings: BarcodeSettings
  templates: SetTemplate[]
  registry: BarcodeTraceRow[]
  cameras: Camera[]
  dealers: Dealer[]
  specialists: Specialist[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [enabled, setEnabled] = useState(settings.enabled)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [lastGenerated, setLastGenerated] = useState<GeneratedBarcode[]>([])
  const [registrySearch, setRegistrySearch] = useState('')
  const [selectedBarcodeId, setSelectedBarcodeId] = useState<string | null>(null)
  const [traceEvents, setTraceEvents] = useState<
    { event_type: string; created_at: string; actor_name: string | null }[]
  >([])

  const [setItems, setSetItems] = useState<{ camera_model_id: string; quantity: number }[]>([
    { camera_model_id: '', quantity: 1 },
  ])

  const dealerScanRef = useRef<HTMLInputElement>(null)
  const specialistScanRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selectedBarcodeId) {
      void getBarcodeTraceEvents(selectedBarcodeId).then((res) => {
        if (res.events) setTraceEvents(res.events)
      })
    } else {
      setTraceEvents([])
    }
  }, [selectedBarcodeId])

  function run(fn: () => Promise<{ error?: string; success?: boolean; barcodes?: GeneratedBarcode[] }>) {
    setMessage(null)
    startTransition(async () => {
      const res = await fn()
      if (res.error) setMessage({ type: 'err', text: res.error })
      else {
        setMessage({ type: 'ok', text: 'Saved.' })
        if (res.barcodes?.length) setLastGenerated(res.barcodes.map((b) => ({ id: b.id, code: b.code, kind: b.kind })))
        router.refresh()
      }
    })
  }

  async function printLabels(barcodes: GeneratedBarcode[]) {
    const labels = await Promise.all(
      barcodes.map(async (b) => ({
        code: b.code,
        kind: b.kind,
        qr: await generateQrDataUrl(b.code, 120),
      }))
    )
    const html = `<!DOCTYPE html><html><head><title>Barcode labels</title>
      <style>
        body { font-family: sans-serif; margin: 16px; }
        .grid { display: flex; flex-wrap: wrap; gap: 12px; }
        .label { border: 1px solid #ccc; padding: 12px; width: 180px; text-align: center; page-break-inside: avoid; }
        .code { font-family: monospace; font-size: 12px; font-weight: bold; margin-top: 8px; word-break: break-all; }
        .kind { font-size: 10px; color: #666; text-transform: uppercase; }
      </style></head><body>
      <div class="grid">${labels
        .map(
          (l) =>
            `<div class="label"><div class="kind">${l.kind}</div><img src="${l.qr}" width="120" height="120" /><div class="code">${l.code}</div></div>`
        )
        .join('')}</div>
      <script>window.onload=()=>window.print()</script></body></html>`
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
    }
  }

  const filteredRegistry = registrySearch.trim()
    ? registry.filter((r) => r.code.toLowerCase().includes(registrySearch.trim().toLowerCase()))
    : registry

  if (!enabled) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-6 bg-zinc-50/80 dark:bg-white/[0.02]">
          <div className="flex items-start gap-3">
            <Barcode className="h-8 w-8 text-[#C27E00] shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Barcode system</h3>
              <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
                Enable scan-based inventory tracking. When off, quantity-based stock continues unchanged.
                Only platform (Aurora Manager) can manage barcodes — not visible to dealers or customers.
              </p>
              <label className="mt-4 inline-flex items-center gap-3 cursor-pointer">
                <span className="text-sm text-zinc-700 dark:text-gray-300">Enable barcode mode</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => {
                    const next = !enabled
                    setEnabled(next)
                    run(() => saveBarcodeSettingsAction({ ...settings, enabled: next }))
                  }}
                  className={`relative w-11 h-6 rounded-full transition ${enabled ? 'bg-[#C27E00]' : 'bg-zinc-400'}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition ${enabled ? 'translate-x-5' : ''}`}
                  />
                </button>
              </label>
            </div>
          </div>
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
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#C27E00]/30 bg-[#C27E00]/5 p-4">
        <div>
          <p className="font-medium text-zinc-900 dark:text-white">Barcode mode active</p>
          <p className="text-xs text-zinc-500">Specialists scan on complete; assignments use barcode scans.</p>
        </div>
        <label className="inline-flex items-center gap-3 cursor-pointer">
          <span className="text-sm text-zinc-700 dark:text-gray-300">Enabled</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => {
              const next = !enabled
              setEnabled(next)
              run(() => saveBarcodeSettingsAction({ ...settings, enabled: next }))
            }}
            className={`relative w-11 h-6 rounded-full transition ${enabled ? 'bg-[#C27E00]' : 'bg-zinc-400'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition ${enabled ? 'translate-x-5' : ''}`}
            />
          </button>
        </label>
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Generate units */}
        <form
          className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => generateUnitBarcodesAction(new FormData(e.currentTarget)))
          }}
        >
          <h3 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
            <Package className="h-4 w-4 text-[#C27E00]" /> Generate unit barcodes
          </h3>
          <select name="camera_model_id" required className={`${inputClass} w-full`}>
            <option value="">Camera model…</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            name="count"
            type="number"
            min={1}
            max={500}
            defaultValue={1}
            className={`${inputClass} w-full`}
            placeholder="Count"
          />
          <button type="submit" disabled={pending} className={btnPrimary}>
            Generate
          </button>
        </form>

        {/* Generate sets */}
        <form
          className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => generateSetBarcodesAction(new FormData(e.currentTarget)))
          }}
        >
          <h3 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#C27E00]" /> Generate set barcodes
          </h3>
          <select name="template_id" required className={`${inputClass} w-full`}>
            <option value="">Set template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code})
              </option>
            ))}
          </select>
          <input
            name="set_count"
            type="number"
            min={1}
            max={100}
            defaultValue={1}
            className={`${inputClass} w-full`}
            placeholder="Number of sets"
          />
          <button type="submit" disabled={pending || templates.length === 0} className={btnPrimary}>
            Generate set batch
          </button>
        </form>
      </div>

      {lastGenerated.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              Last generated ({lastGenerated.length})
            </p>
            <button
              type="button"
              onClick={() => void printLabels(lastGenerated)}
              className="inline-flex items-center gap-1 text-sm text-[#C27E00] hover:underline"
            >
              <Printer className="h-4 w-4" /> Print labels
            </button>
          </div>
          <p className="text-xs text-zinc-500 font-mono truncate">
            {lastGenerated.map((b) => b.code).join(', ')}
          </p>
        </div>
      )}

      {/* Set templates */}
      <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 space-y-4">
        <h3 className="font-medium text-zinc-900 dark:text-white">Set templates</h3>
        <form
          className="grid sm:grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            fd.set('items_json', JSON.stringify(setItems.filter((i) => i.camera_model_id && i.quantity >= 1)))
            run(async () => {
              const res = await createBarcodeSetTemplate(fd)
              if (!res.error) {
                setSetItems([{ camera_model_id: '', quantity: 1 }])
                e.currentTarget.reset()
              }
              return res
            })
          }}
        >
          <input name="name" required placeholder="Template name" className={inputClass} />
          <input name="code" required placeholder="Code (e.g. KIT-STD)" className={inputClass} />
          <input name="description" placeholder="Description" className={`${inputClass} sm:col-span-2`} />
          <div className="sm:col-span-2 space-y-2">
            <p className="text-xs text-zinc-500">Products in set</p>
            {setItems.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <select
                  value={item.camera_model_id}
                  onChange={(e) => {
                    const next = [...setItems]
                    next[idx] = { ...next[idx]!, camera_model_id: e.target.value }
                    setSetItems(next)
                  }}
                  className={`${inputClass} flex-1`}
                >
                  <option value="">Model…</option>
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...setItems]
                    next[idx] = { ...next[idx]!, quantity: parseInt(e.target.value, 10) || 1 }
                    setSetItems(next)
                  }}
                  className={`${inputClass} w-20`}
                />
                {setItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSetItems(setItems.filter((_, i) => i !== idx))}
                    className="p-2 text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSetItems([...setItems, { camera_model_id: '', quantity: 1 }])}
              className="text-xs text-[#C27E00] inline-flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add product
            </button>
          </div>
          <button type="submit" disabled={pending} className={`${btnPrimary} sm:col-span-2`}>
            Create template
          </button>
        </form>

        {templates.length > 0 && (
          <ul className="divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
            {templates.map((t) => (
              <li key={t.id} className="py-2 flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium text-zinc-900 dark:text-white">{t.name}</span>
                  <span className="text-zinc-500 ml-2">{t.code}</span>
                  {t.items && t.items.length > 0 && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {t.items
                        .map(
                          (i) =>
                            `${(i.camera_models as { name: string } | null)?.name ?? 'Model'} × ${i.quantity}`
                        )
                        .join(', ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => run(() => deleteBarcodeSetTemplate(t.id))}
                  className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Scan assign */}
      <div className="grid lg:grid-cols-2 gap-6">
        <form
          className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            run(async () => {
              const res = await scanAssignBarcodeToDealer(new FormData(e.currentTarget))
              if (!res.error) {
                e.currentTarget.reset()
                dealerScanRef.current?.focus()
              }
              return res
            })
          }}
        >
          <h3 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-[#C27E00]" /> Assign to dealer (scan)
          </h3>
          <select name="dealer_id" required className={`${inputClass} w-full`}>
            <option value="">Dealer…</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            ref={dealerScanRef}
            name="code"
            required
            autoComplete="off"
            placeholder="Scan or enter barcode…"
            className={`${inputClass} w-full font-mono`}
          />
          <button type="submit" disabled={pending} className={btnPrimary}>
            Assign to dealer
          </button>
        </form>

        <form
          className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            run(async () => {
              const res = await scanAssignBarcodeToSpecialist(new FormData(e.currentTarget))
              if (!res.error) {
                e.currentTarget.reset()
                specialistScanRef.current?.focus()
              }
              return res
            })
          }}
        >
          <h3 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-[#C27E00]" /> Assign to specialist (scan)
          </h3>
          <select name="dealer_id" required className={`${inputClass} w-full`}>
            <option value="">Dealer…</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select name="specialist_id" required className={`${inputClass} w-full`}>
            <option value="">Specialist…</option>
            {specialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name ?? s.id}
              </option>
            ))}
          </select>
          <input
            ref={specialistScanRef}
            name="code"
            required
            autoComplete="off"
            placeholder="Scan or enter barcode…"
            className={`${inputClass} w-full font-mono`}
          />
          <button type="submit" disabled={pending} className={btnPrimary}>
            Assign to specialist
          </button>
        </form>
      </div>

      {/* Registry */}
      <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-zinc-900 dark:text-white">Barcode registry</h3>
          <input
            value={registrySearch}
            onChange={(e) => setRegistrySearch(e.target.value)}
            placeholder="Search code…"
            className={`${inputClass} w-48`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-gray-800">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">Model</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Demand / Customer</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
              {filteredRegistry.map((row) => (
                <tr
                  key={row.id}
                  className={`cursor-pointer ${selectedBarcodeId === row.id ? 'bg-[#C27E00]/10' : ''}`}
                  onClick={() => setSelectedBarcodeId(row.id === selectedBarcodeId ? null : row.id)}
                >
                  <td className="py-2 pr-3 font-mono text-xs">{row.code}</td>
                  <td className="py-2 pr-3">{row.kind}</td>
                  <td className="py-2 pr-3">{row.camera_model_name ?? '—'}</td>
                  <td className="py-2 pr-3">{statusBadge(row.status)}</td>
                  <td className="py-2 pr-3 text-xs">
                    {row.demand_number ? (
                      <>
                        <span className="text-zinc-900 dark:text-white">{row.demand_number}</span>
                        {row.customer_firstname && (
                          <span className="text-zinc-500 block">
                            {row.customer_firstname} {row.customer_lastname}
                            {row.customer_phone ? ` · ${row.customer_phone}` : ''}
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2">
                    {row.status !== 'consumed' && row.status !== 'void' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Void barcode ${row.code}?`)) run(() => voidBarcodeAction(row.id))
                        }}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedBarcodeId && traceEvents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-gray-800">
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Event timeline</p>
            <ul className="space-y-1 text-xs text-zinc-600 dark:text-gray-400">
              {traceEvents.map((ev) => (
                <li key={ev.created_at + ev.event_type}>
                  {new Date(ev.created_at).toLocaleString()} — {ev.event_type}
                  {ev.actor_name ? ` by ${ev.actor_name}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
