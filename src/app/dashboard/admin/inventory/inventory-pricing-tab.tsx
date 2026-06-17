'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { upsertDealerCameraPricing } from './actions'
import { TRANSFER_FEE_CAD, REMOVAL_FEE_CAD } from '@/lib/demand-pricing'

type DealerRow = { id: string; name: string }
type CameraRow = { id: string; name: string }
type PricingRow = { dealer_id: string; camera_model_id: string; price_cad: number }

type Props = {
  dealers: DealerRow[]
  cameras: CameraRow[]
  pricing: PricingRow[]
}

export function InventoryPricingTab({ dealers, cameras, pricing }: Props) {
  const router = useRouter()
  const [dealerId, setDealerId] = useState(dealers[0]?.id ?? '')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const priceByKey = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of pricing) {
      if (p.dealer_id === dealerId) {
        map.set(p.camera_model_id, Number(p.price_cad))
      }
    }
    return map
  }, [pricing, dealerId])

  const selectedDealer = dealers.find((d) => d.id === dealerId)

  function displayPrice(cameraId: string): string {
    if (drafts[cameraId] !== undefined) return drafts[cameraId]
    const saved = priceByKey.get(cameraId)
    return saved != null ? String(saved) : ''
  }

  async function savePrice(cameraId: string) {
    const raw = displayPrice(cameraId).trim()
    if (!raw) {
      setMsg({ type: 'err', text: 'Enter a price before saving.' })
      return
    }
    const price = parseFloat(raw)
    if (!Number.isFinite(price) || price < 0) {
      setMsg({ type: 'err', text: 'Price must be 0 or greater.' })
      return
    }
    if (!dealerId) {
      setMsg({ type: 'err', text: 'Select a dealer first.' })
      return
    }

    setSavingId(cameraId)
    setMsg(null)
    const fd = new FormData()
    fd.set('dealer_id', dealerId)
    fd.set('camera_model_id', cameraId)
    fd.set('price_cad', String(price))
    const result = await upsertDealerCameraPricing(fd)
    setSavingId(null)
    if (result.error) {
      setMsg({ type: 'err', text: result.error })
      return
    }
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[cameraId]
      return next
    })
    setMsg({ type: 'ok', text: 'Price saved.' })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-gray-400">
        Set installation prices per dealer and camera model. When a specialist completes a job as{' '}
        <strong className="text-zinc-600 dark:text-gray-300 font-medium">Installation</strong>, the invoice amount is
        taken from this table. Transfer and removal use fixed fees (${TRANSFER_FEE_CAD} / ${REMOVAL_FEE_CAD} CAD).
      </p>

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

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 dark:border-gray-800 bg-white/[0.03] p-3">
        <div className="min-w-[220px] flex-1">
          <label className="block text-[10px] text-zinc-500 dark:text-gray-500 uppercase mb-1">Dealer</label>
          <select
            value={dealerId}
            onChange={(e) => {
              setDealerId(e.target.value)
              setDrafts({})
              setMsg(null)
            }}
            className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white"
          >
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        {selectedDealer && (
          <p className="text-sm text-zinc-500 dark:text-gray-400 pb-1">
            Editing prices for <span className="text-zinc-800 dark:text-gray-200 font-medium">{selectedDealer.name}</span>
          </p>
        )}
      </div>

      {!dealerId ? (
        <p className="text-sm text-zinc-500 dark:text-gray-500">No dealers available.</p>
      ) : cameras.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-gray-500">No camera models in catalog.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-gray-800">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-200/50 dark:bg-white/5 text-zinc-500 dark:text-gray-400 text-left">
              <tr>
                <th className="px-3 py-2">Camera model</th>
                <th className="px-3 py-2 text-right w-40">Price (CAD)</th>
                <th className="px-3 py-2 text-right w-[1%] whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-gray-800 text-zinc-800 dark:text-gray-200">
              {cameras.map((c) => {
                const saved = priceByKey.get(c.id)
                const draft = drafts[c.id]
                const dirty = draft !== undefined && draft !== (saved != null ? String(saved) : '')
                return (
                  <tr key={c.id}>
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={displayPrice(c.id)}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [c.id]: e.target.value,
                          }))
                        }
                        placeholder="—"
                        className="w-full max-w-[140px] ml-auto rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white tabular-nums text-right focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={savingId === c.id || (!dirty && saved == null && !drafts[c.id]?.trim())}
                        onClick={() => savePrice(c.id)}
                        className="rounded border border-[#C27E00]/40 bg-[#C27E00]/10 px-2 py-1 text-[10px] font-medium text-[#C27E00] hover:bg-[#C27E00]/20 disabled:opacity-50"
                      >
                        {savingId === c.id ? (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Saving…
                          </span>
                        ) : (
                          'Save'
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
