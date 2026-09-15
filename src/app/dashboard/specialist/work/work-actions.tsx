'use client'

import { assignWorkToMe, completeDemand, previewWorkBarcode } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DemandServiceType, SERVICE_TYPE_LABELS } from '@/lib/demand-pricing'
import { Loader2, X } from 'lucide-react'

const SERVICE_OPTIONS: DemandServiceType[] = ['installation', 'transfer', 'removal']

type ScannedBarcode = { code: string; modelName: string }

export function WorkActions({
  demandId,
  isAssigned,
  vinLast6,
  barcodeModeEnabled = false,
}: {
  demandId: string
  isAssigned: boolean
  vinLast6?: string | null
  barcodeModeEnabled?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [directComplete, setDirectComplete] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [serviceType, setServiceType] = useState<DemandServiceType>('installation')
  const [vinInput, setVinInput] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scannedBarcodes, setScannedBarcodes] = useState<ScannedBarcode[]>([])
  const [scanPending, setScanPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleAssign = async () => {
    setLoading(true)
    const result = await assignWorkToMe(demandId)
    if (result?.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  const openCompleteModal = () => {
    setError(null)
    setServiceType('installation')
    setBarcodeInput('')
    setScannedBarcodes([])
    if (directComplete && vinLast6) {
      setVinInput(vinLast6.trim())
    } else {
      setVinInput('')
    }
    setShowModal(true)
  }

  async function addScannedBarcode() {
    const raw = barcodeInput.trim()
    if (!raw) return
    if (scannedBarcodes.some((b) => b.code.toLowerCase() === raw.toLowerCase())) {
      setError('This barcode is already in the list.')
      setBarcodeInput('')
      return
    }
    setScanPending(true)
    setError(null)
    const preview = await previewWorkBarcode(raw)
    setScanPending(false)
    if ('error' in preview && preview.error) {
      setError(preview.error)
      return
    }
    if ('ok' in preview && preview.ok) {
      setScannedBarcodes((prev) => [...prev, { code: preview.code, modelName: preview.modelName }])
      setBarcodeInput('')
    }
  }

  const handleComplete = async () => {
    let resolvedVin: string | undefined
    let skipVinCheck = false

    if (directComplete && vinLast6) {
      resolvedVin = vinLast6.trim()
    } else if (directComplete && !vinLast6) {
      skipVinCheck = true
    } else {
      const entered = vinInput.trim()
      if (!entered) {
        setError('Enter VIN last 6 digits to complete this demand.')
        return
      }
      resolvedVin = entered
    }

    if (barcodeModeEnabled && scannedBarcodes.length === 0) {
      setError('Scan at least one product barcode (Enter after each scan).')
      return
    }

    setLoading(true)
    setError(null)
    const result = await completeDemand(demandId, {
      serviceType,
      vinLast6: resolvedVin,
      skipVinCheck: skipVinCheck || undefined,
      barcodeCodes: barcodeModeEnabled ? scannedBarcodes.map((b) => b.code) : undefined,
    })
    setLoading(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setShowModal(false)
    router.refresh()
  }

  if (!isAssigned) {
    return (
      <button
        onClick={handleAssign}
        disabled={loading}
        className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors"
      >
        {loading ? 'Assigning...' : 'Assign to Me'}
      </button>
    )
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={directComplete}
            onChange={(e) => setDirectComplete(e.target.checked)}
            className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-0"
          />
          <span className="text-sm text-zinc-600 dark:text-gray-300">Direct complete (use stored VIN)</span>
        </label>
        <button
          onClick={openCompleteModal}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors"
        >
          Complete Job
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-job-title"
            className="w-full max-w-md rounded-lg border border-zinc-300 dark:border-gray-700 bg-white dark:bg-zinc-900 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-gray-800 px-4 py-3">
              <h2 id="complete-job-title" className="text-lg font-semibold text-zinc-900 dark:text-white">
                Complete job
              </h2>
              <button
                type="button"
                onClick={() => !loading && setShowModal(false)}
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-4 space-y-4">
              <fieldset>
                <legend className="block text-sm font-medium text-zinc-700 dark:text-gray-300 mb-2">
                  Service type *
                </legend>
                <div className="space-y-2">
                  {SERVICE_OPTIONS.map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer ${
                        serviceType === opt
                          ? 'border-[#C27E00]/60 bg-[#C27E00]/10'
                          : 'border-zinc-200 dark:border-gray-700 hover:bg-zinc-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="radio"
                        name="serviceType"
                        value={opt}
                        checked={serviceType === opt}
                        onChange={() => setServiceType(opt)}
                        className="text-[#C27E00] focus:ring-[#C27E00]"
                      />
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">
                        {SERVICE_TYPE_LABELS[opt]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {!(directComplete && vinLast6) && !(directComplete && !vinLast6) && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-gray-300 mb-1">
                    VIN last 6 digits *
                  </label>
                  <input
                    type="text"
                    value={vinInput}
                    onChange={(e) => setVinInput(e.target.value)}
                    maxLength={6}
                    placeholder="Last 6 of VIN"
                    className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-gray-900 px-3 py-2 text-sm text-zinc-900 dark:text-white uppercase tracking-widest focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                  />
                </div>
              )}

              {directComplete && vinLast6 && (
                <p className="text-sm text-zinc-500 dark:text-gray-400">
                  Using stored VIN: <span className="font-mono text-zinc-800 dark:text-gray-200">{vinLast6}</span>
                </p>
              )}

              {directComplete && !vinLast6 && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  No VIN on file — completion will proceed without VIN verification.
                </p>
              )}

              {barcodeModeEnabled && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-gray-300 mb-1">
                    Product barcodes *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void addScannedBarcode()
                        }
                      }}
                      autoComplete="off"
                      placeholder="Scan unit barcode, press Enter…"
                      disabled={scanPending || loading}
                      className="flex-1 rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-gray-900 px-3 py-2 text-sm text-zinc-900 dark:text-white font-mono focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                    />
                    <button
                      type="button"
                      disabled={scanPending || !barcodeInput.trim() || loading}
                      onClick={() => void addScannedBarcode()}
                      className="shrink-0 rounded-md border border-[#C27E00]/50 px-3 py-2 text-sm text-[#C27E00] hover:bg-[#C27E00]/10 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Scan each installed unit (e.g. Nova + battery = 2 barcodes). Do not scan the set box label.
                  </p>
                  {scannedBarcodes.length > 0 && (
                    <ul className="mt-2 space-y-1 rounded-md border border-zinc-200 dark:border-gray-800 divide-y divide-zinc-200 dark:divide-gray-800">
                      {scannedBarcodes.map((b) => (
                        <li
                          key={b.code}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm bg-zinc-50 dark:bg-black/30"
                        >
                          <span>
                            <span className="font-mono text-zinc-900 dark:text-white">{b.code}</span>
                            <span className="text-zinc-500 ml-2">{b.modelName}</span>
                          </span>
                          <button
                            type="button"
                            className="text-xs text-red-400 hover:underline"
                            onClick={() =>
                              setScannedBarcodes((prev) => prev.filter((x) => x.code !== b.code))
                            }
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 dark:border-gray-800 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="rounded-md border border-zinc-300 dark:border-gray-600 px-4 py-2 text-sm text-zinc-700 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-green-600 hover:bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Completing…' : 'Confirm complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
