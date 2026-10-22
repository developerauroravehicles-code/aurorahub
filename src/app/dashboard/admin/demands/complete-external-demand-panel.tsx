'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  completeExternalDemand,
  previewExternalDemandBarcode,
  type CompleteExternalDemandState,
} from './create-external-demand-actions'
import {
  DemandServiceType,
  SERVICE_TYPE_LABELS,
  isBarcodeRequiredForServiceType,
} from '@/lib/demand-pricing'

type Specialist = { id: string; full_name: string | null }

type Props = {
  demandId: string
  cameraModelId: string | null
  specialists: Specialist[]
  barcodeModeEnabled: boolean
  initialSpecialistId: string | null
}

type Scanned = { code: string; modelName: string; cameraModelId: string }

export function CompleteExternalDemandPanel({
  demandId,
  cameraModelId,
  specialists,
  barcodeModeEnabled,
  initialSpecialistId,
}: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    completeExternalDemand,
    null as CompleteExternalDemandState
  )
  const [serviceType, setServiceType] = useState<DemandServiceType>('installation')
  const [specialistId, setSpecialistId] = useState(initialSpecialistId ?? '')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scanned, setScanned] = useState<Scanned[]>([])
  const [scanPending, setScanPending] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)

  const showBarcodes = barcodeModeEnabled
  const barcodeRequired = showBarcodes && isBarcodeRequiredForServiceType(serviceType)

  async function addBarcode() {
    const code = barcodeInput.trim()
    if (!code) return
    if (!specialistId) {
      setClientError('Select a specialist before scanning barcodes.')
      return
    }
    setClientError(null)
    setScanPending(true)
    const result = await previewExternalDemandBarcode(specialistId, code)
    setScanPending(false)
    if ('error' in result) {
      setClientError(result.error ?? 'Barcode lookup failed.')
      return
    }
    setScanned((prev) => {
      if (prev.some((b) => b.code === result.code)) return prev
      return [...prev, { code: result.code, modelName: result.modelName, cameraModelId: result.cameraModelId }]
    })
    setBarcodeInput('')
  }

  if (state?.success) {
    return (
      <div className="rounded-lg border border-green-800/40 bg-green-950/20 p-4 text-sm text-green-200">
        External demand marked completed.{' '}
        <button
          type="button"
          className="underline text-[#C27E00]"
          onClick={() => router.refresh()}
        >
          Refresh
        </button>
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className="rounded-lg border border-[#C27E00]/40 bg-[#C27E00]/5 p-4 space-y-4"
      onSubmit={(e) => {
        if (barcodeRequired && scanned.length === 0) {
          e.preventDefault()
          setClientError('Scan at least one unit barcode before completing.')
          return
        }
        if (barcodeRequired && !specialistId) {
          e.preventDefault()
          setClientError('Select the specialist who performed the work.')
          return
        }
        setClientError(null)
      }}
    >
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Complete external demand</h3>
        <p className="text-xs text-zinc-500 dark:text-gray-400 mt-1">
          Aurora Manager only — closes this retroactive job as completed (uses job date for reporting; skips
          finance queue).
        </p>
      </div>

      {(state?.error || clientError) && (
        <p className="text-sm text-red-600 dark:text-red-300">{clientError ?? state?.error}</p>
      )}

      <input type="hidden" name="demandId" value={demandId} />
      {cameraModelId ? <input type="hidden" name="cameraModelId" value={cameraModelId} /> : null}
      {scanned.map((b) => (
        <input key={b.code} type="hidden" name="barcodeCodes" value={b.code} />
      ))}

      <div className="space-y-2">
        <span className="block text-xs font-medium text-zinc-600 dark:text-gray-300">Service type *</span>
        <div className="flex flex-wrap gap-2">
          {(['installation', 'transfer', 'removal'] as const).map((value) => (
            <label
              key={value}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${
                serviceType === value
                  ? 'border-[#C27E00]/60 bg-[#C27E00]/10'
                  : 'border-zinc-300 dark:border-gray-700'
              }`}
            >
              <input
                type="radio"
                name="serviceType"
                value={value}
                checked={serviceType === value}
                onChange={() => setServiceType(value)}
                className="text-[#C27E00]"
              />
              {SERVICE_TYPE_LABELS[value]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-gray-300 mb-1">
          Specialist{barcodeRequired ? ' *' : ''}
        </label>
        <select
          name="assignedSpecialistId"
          value={specialistId}
          onChange={(e) => setSpecialistId(e.target.value)}
          className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-3 py-2 text-sm"
        >
          <option value="">— Select —</option>
          {specialists.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name ?? 'Unknown'}
            </option>
          ))}
        </select>
      </div>

      {showBarcodes && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-zinc-600 dark:text-gray-300">
            Product barcodes{barcodeRequired ? ' *' : ' (optional for transfer)'}
          </label>
          <div className="flex gap-2">
            <input
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addBarcode()
                }
              }}
              disabled={scanPending}
              placeholder="Scan unit label, Enter to add"
              className="flex-1 rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-3 py-2 text-sm font-mono uppercase"
            />
            <button
              type="button"
              disabled={scanPending || !barcodeInput.trim()}
              onClick={() => void addBarcode()}
              className="shrink-0 rounded-md border border-zinc-300 dark:border-gray-600 px-3 py-2 text-sm"
            >
              Add
            </button>
          </div>
          {scanned.length > 0 && (
            <ul className="text-xs text-zinc-600 dark:text-gray-400 space-y-1">
              {scanned.map((b) => (
                <li key={b.code} className="flex justify-between gap-2">
                  <span className="font-mono">{b.code}</span>
                  <span>{b.modelName}</span>
                  <button
                    type="button"
                    className="text-red-500 hover:underline"
                    onClick={() => setScanned((prev) => prev.filter((x) => x.code !== b.code))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[#C27E00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a06900] disabled:opacity-50"
      >
        {pending ? 'Completing…' : 'Mark completed'}
      </button>
    </form>
  )
}
