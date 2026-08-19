'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, DollarSign, Wrench, Car, ArrowRightLeft, Unplug, Clock } from 'lucide-react'
import type { SpecialistCompensationSnapshot } from '@/lib/specialist-compensation'
import { formatRatesSummary } from '@/lib/specialist-compensation'
import {
  addSpecialistManualPayrollItem,
  deleteSpecialistManualPayrollItem,
  getSpecialistCompensationSnapshot,
} from './compensation-actions'

type Props = {
  profileId: string
  initialSnapshot: SpecialistCompensationSnapshot
}

export function SpecialistCompensationPanel({ profileId, initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [periodStart, setPeriodStart] = useState(initialSnapshot.period_start)
  const [periodEnd, setPeriodEnd] = useState(initialSnapshot.period_end)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getSpecialistCompensationSnapshot(profileId, periodStart, periodEnd)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.snapshot) setSnapshot(result.snapshot)
  }, [profileId, periodStart, periodEnd])

  useEffect(() => {
    if (
      periodStart === initialSnapshot.period_start &&
      periodEnd === initialSnapshot.period_end
    ) {
      return
    }
    void (async () => {
      setLoading(true)
      setError(null)
      const result = await getSpecialistCompensationSnapshot(profileId, periodStart, periodEnd)
      setLoading(false)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.snapshot) setSnapshot(result.snapshot)
    })()
  }, [profileId, periodStart, periodEnd, initialSnapshot.period_start, initialSnapshot.period_end])

  async function handleAddManual() {
    setSubmitting(true)
    setError(null)
    const result = await addSpecialistManualPayrollItem(
      profileId,
      label,
      parseFloat(amount),
      periodStart,
      periodEnd,
      notes
    )
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setLabel('')
    setAmount('')
    setNotes('')
    await refresh()
  }

  async function handleDelete(itemId: string) {
    setError(null)
    const result = await deleteSpecialistManualPayrollItem(itemId, profileId)
    if (result.error) setError(result.error)
    else await refresh()
  }

  return (
    <section className="space-y-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-[#C27E00]" />
            Compensation (live estimate)
          </h2>
          <p className="text-sm text-zinc-500 dark:text-gray-400 mt-0.5">
            Net pay by job type for the selected period. Delay fees shown separately in USD.
          </p>
        </div>
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-zinc-400" /> : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Period start</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Period end</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
          <p className="text-xs text-zinc-500 flex items-center gap-1">
            <Car className="h-3.5 w-3.5" /> Installations
          </p>
          <p className="text-2xl font-bold text-[#C27E00] mt-1">{snapshot.installations_completed}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
          <p className="text-xs text-zinc-500 flex items-center gap-1">
            <Unplug className="h-3.5 w-3.5" /> Removals
          </p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{snapshot.removals_completed}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
          <p className="text-xs text-zinc-500 flex items-center gap-1">
            <ArrowRightLeft className="h-3.5 w-3.5" /> Transfers
          </p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{snapshot.transfers_completed}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
          <p className="text-xs text-zinc-500 flex items-center gap-1">
            <Wrench className="h-3.5 w-3.5" /> Service jobs
          </p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
            {snapshot.service_jobs_completed}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
          <p className="text-xs text-zinc-500 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Delays
          </p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
            {snapshot.delay_30min_count + snapshot.delay_60min_count}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 p-3">
          <p className="text-xs text-green-700 dark:text-green-400">Net pay (CAD)</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1 tabular-nums">
            ${snapshot.estimated_net_cad.toFixed(2)}
          </p>
        </div>
        {snapshot.estimated_delay_usd > 0 ? (
          <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-3">
            <p className="text-xs text-blue-700 dark:text-blue-400">Delay fees (USD)</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1 tabular-nums">
              ${snapshot.estimated_delay_usd.toFixed(2)}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
            <p className="text-xs text-zinc-500">Delay fees (USD)</p>
            <p className="text-2xl font-bold text-zinc-400 mt-1 tabular-nums">$0.00</p>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-500">{formatRatesSummary(snapshot.rates_used)}</p>

      {snapshot.pay_lines.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Line</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {snapshot.pay_lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2 text-zinc-800 dark:text-gray-200">{line.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    ${line.amount.toFixed(2)} {line.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Manual pay / expense lines</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Description (e.g. Travel reimbursement)"
            className="sm:col-span-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount CAD"
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={submitting || !label.trim() || !amount}
          onClick={() => void handleAddManual()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#C27E00] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add line
        </button>

        {snapshot.manual_items.length > 0 ? (
          <ul className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
            {snapshot.manual_items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 text-sm text-zinc-700 dark:text-gray-300"
              >
                <div>
                  <span className="font-medium">{item.label}</span>
                  {item.notes ? (
                    <span className="text-zinc-500 dark:text-gray-500"> — {item.notes}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-semibold">${item.amount.toFixed(2)} CAD</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  )
}
