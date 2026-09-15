'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DEMAND_BARCODE_CHANGE_REASONS } from '@/lib/inventory-barcodes/reassign-demand-barcode'
import { changeDemandInstalledBarcodeAction } from './barcode-actions'

const inputClass =
  'rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-3 py-2 text-sm text-zinc-900 dark:text-white w-full focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]'

export function DemandBarcodeChangeForm({
  demandId,
  dealerId,
  specialistId,
  serviceType,
  installedBarcodeCodes,
  canEdit,
}: {
  demandId: string
  dealerId: string
  specialistId: string | null
  serviceType: 'installation' | 'transfer' | 'removal'
  installedBarcodeCodes: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  if (installedBarcodeCodes.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-gray-400 mt-3">
        No product barcode is linked to this completed installation.
      </p>
    )
  }

  const barcodeList = (
    <ul className="space-y-1">
      {installedBarcodeCodes.map((code) => (
        <li key={code} className="font-mono text-sm text-zinc-900 dark:text-white">
          {code}
        </li>
      ))}
    </ul>
  )

  if (!canEdit) {
    return (
      <div className="mt-3 text-sm">
        <p className="text-zinc-500 dark:text-gray-400 mb-1">
          Installed barcode{installedBarcodeCodes.length > 1 ? 's' : ''}
        </p>
        {barcodeList}
      </div>
    )
  }

  return (
    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-gray-800">
      <p className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
        Installed product barcode{installedBarcodeCodes.length > 1 ? 's' : ''}
      </p>
      <div className="text-[#C27E00] mb-3">{barcodeList}</div>
      {installedBarcodeCodes.length > 1 && (
        <p className="text-xs text-zinc-500 mb-3">
          Barcode change below applies to the first linked unit; contact support if you need to swap a specific unit.
        </p>
      )}
      <p className="text-xs text-zinc-500 mb-3">
        Change only with a documented reason (return, warranty swap, correction). Old unit returns to specialist
        stock when applicable.
      </p>
      {message && (
        <div
          className={`mb-3 rounded-md px-3 py-2 text-sm ${
            message.type === 'err'
              ? 'bg-red-950/40 text-red-200 border border-red-900/50'
              : 'bg-green-950/40 text-green-200 border border-green-900/50'
          }`}
        >
          {message.text}
        </div>
      )}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget
          const fd = new FormData(form)
          setMessage(null)
          startTransition(async () => {
            const res = await changeDemandInstalledBarcodeAction(fd)
            if (res.error) {
              setMessage({ type: 'err', text: res.error })
            } else {
              setMessage({
                type: 'ok',
                text: res.newCode ? `Barcode updated to ${res.newCode}` : 'Barcode updated.',
              })
              form.reset()
              router.refresh()
            }
          })
        }}
      >
        <input type="hidden" name="demand_id" value={demandId} />
        <input type="hidden" name="dealer_id" value={dealerId} />
        <input type="hidden" name="specialist_id" value={specialistId ?? ''} />
        <input type="hidden" name="service_type" value={serviceType} />
        <div>
          <label className="block text-xs text-zinc-500 mb-1">New barcode (scan or type)</label>
          <input
            name="new_barcode_code"
            required
            autoComplete="off"
            className={`${inputClass} font-mono`}
            placeholder="Scan replacement unit…"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Reason</label>
          <select name="reason" required className={inputClass}>
            {DEMAND_BARCODE_CHANGE_REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Explanation (required)</label>
          <textarea
            name="notes"
            required
            rows={2}
            className={inputClass}
            placeholder="e.g. Wrong unit scanned; customer return; defective camera replaced under warranty"
          />
        </div>
        <button
          type="submit"
          disabled={pending || !specialistId}
          className="rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white hover:bg-[#a06900] disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Change installed barcode'}
        </button>
        {!specialistId && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Assign a specialist on this demand first.</p>
        )}
      </form>
    </div>
  )
}
