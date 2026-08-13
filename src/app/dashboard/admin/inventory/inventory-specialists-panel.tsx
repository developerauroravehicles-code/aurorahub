'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Users } from 'lucide-react'
import type { SpecialistStockSummaryRow } from '@/lib/inventory-v2/specialist-stock'
import { postDealerToSpecialistTransfer } from './actions'

type Camera = { id: string; name: string }
type Dealer = { id: string; name: string }

const inputClass =
  'rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]'
const btnPrimary =
  'rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white hover:bg-[#a06900] disabled:opacity-50'

function qtyClass(q: number) {
  if (q < 0) return 'text-red-400 font-semibold'
  if (q === 0) return 'text-zinc-400'
  return 'text-zinc-900 dark:text-white'
}

export function InventorySpecialistsPanel({
  specialistStock,
  dealers,
  cameras,
}: {
  specialistStock: SpecialistStockSummaryRow[]
  dealers: Dealer[]
  cameras: Camera[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const totalSpecialists = specialistStock.length
  const totalUnits = specialistStock.reduce((s, r) => s + r.total_units, 0)
  const negativeCount = specialistStock.reduce(
    (s, r) => s + r.balances.filter((b) => b.quantity < 0).length,
    0
  )

  function runAction(action: () => Promise<{ error?: string; success?: boolean }>) {
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        setMessage({ type: 'err', text: result.error })
      } else {
        setMessage({ type: 'ok', text: 'Transfer recorded.' })
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 bg-zinc-50/80 dark:bg-white/[0.02]">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Specialists</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-white tabular-nums">{totalSpecialists}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 bg-zinc-50/80 dark:bg-white/[0.02]">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Total field stock</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-white tabular-nums">{totalUnits}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 bg-zinc-50/80 dark:bg-white/[0.02]">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Negative balances</p>
          <p className={`text-2xl font-semibold tabular-nums ${negativeCount > 0 ? 'text-red-400' : 'text-zinc-900 dark:text-white'}`}>
            {negativeCount}
          </p>
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

      <form
        className="rounded-xl border border-zinc-200 dark:border-gray-800 p-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          runAction(() => postDealerToSpecialistTransfer(new FormData(e.currentTarget)))
        }}
      >
        <h3 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
          <Users className="h-4 w-4 text-[#C27E00]" />
          Assign cameras to specialist
        </h3>
        <p className="text-xs text-zinc-500">
          Transfers stock from dealer to specialist field inventory. Completed installations consume from both dealer and specialist stock.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select name="dealer_id" required className={`${inputClass} w-full`}>
            <option value="">Dealer…</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select name="specialist_profile_id" required className={`${inputClass} w-full`}>
            <option value="">Specialist…</option>
            {specialistStock.map((s) => (
              <option key={s.specialist_id} value={s.specialist_id}>
                {s.specialist_name}
              </option>
            ))}
          </select>
          <select name="camera_model_id" required className={`${inputClass} w-full`}>
            <option value="">Camera model…</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            required
            className={`${inputClass} w-full`}
            placeholder="Qty"
          />
        </div>
        <button type="submit" disabled={pending} className={btnPrimary}>
          Transfer to specialist
        </button>
      </form>

      <div className="rounded-xl border border-zinc-200 dark:border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-gray-800 bg-zinc-50/80 dark:bg-white/[0.02]">
          <h3 className="font-medium text-zinc-900 dark:text-white">Specialist field stock</h3>
        </div>
        {specialistStock.length === 0 ? (
          <p className="p-6 text-zinc-500 text-sm">No specialists found.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
            {specialistStock.map((row) => {
              const expanded = expandedId === row.specialist_id
              return (
                <li key={row.specialist_id} className="p-4">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : row.specialist_id)}
                    className="w-full flex items-start justify-between gap-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900 dark:text-white">{row.specialist_name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {row.dealer_names.length > 0 ? row.dealer_names.join(', ') : 'No dealers linked'}
                      </p>
                      {row.balances.length > 0 && !expanded && (
                        <p className="text-sm text-zinc-600 dark:text-gray-400 mt-1">
                          {row.balances.map((b) => `${b.model_name}: ${b.quantity}`).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`tabular-nums text-sm font-semibold ${qtyClass(row.total_units)}`}>
                        {row.total_units} units
                      </span>
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-zinc-500" />
                      )}
                    </div>
                  </button>
                  {expanded && (
                    <div className="mt-3 pl-2">
                      {row.balances.length === 0 ? (
                        <p className="text-sm text-zinc-500">No field stock assigned.</p>
                      ) : (
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-zinc-500">
                              <th className="py-1 pr-4 font-medium">Model</th>
                              <th className="py-1 font-medium">Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.balances.map((b) => (
                              <tr key={b.camera_model_id}>
                                <td className="py-1 pr-4 text-zinc-900 dark:text-white">{b.model_name}</td>
                                <td className={`py-1 tabular-nums ${qtyClass(b.quantity)}`}>{b.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
