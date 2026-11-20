'use client'

import { useEffect, useRef, useState } from 'react'
import { decodeVinForDemand } from '@/lib/vin-decode/decode-vin-action'
import type { DemandVehicleFieldsFromVin } from '@/lib/vin-decode/map-to-demand-vehicle'
import { normalizeVinInput } from '@/lib/vin-decode/nhtsa-vpic'
import { vinLast6FromFullVin } from '@/lib/vin-decode/form-warning'

type VinDecodeFieldProps = {
  disabled?: boolean
  /** `capture` = store VIN only (decode after submit). `decode` = lookup while typing (admin re-decode). */
  mode?: 'capture' | 'decode'
  onDecoded?: (
    fields: DemandVehicleFieldsFromVin,
    hint?: string,
    markVinDecodeWarning?: boolean
  ) => void
  onDecodeFailed?: (payload: { vinLast6: string; error: string }) => void
  onVinFull?: (payload: { vinLast6: string; fullVin: string }) => void
  onPendingChange?: (pending: boolean) => void
  inputClassName?: string
  buttonClassName?: string
}

export function VinDecodeField({
  disabled = false,
  mode = 'capture',
  onDecoded,
  onDecodeFailed,
  onVinFull,
  onPendingChange,
  inputClassName = '',
  buttonClassName = '',
}: VinDecodeFieldProps) {
  const [fullVin, setFullVin] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | 'warning'; text: string } | null>(
    null
  )
  const lastDecodeVin = useRef('')
  const decodeGen = useRef(0)

  useEffect(() => {
    const normalized = normalizeVinInput(fullVin)
    if (normalized.length === 17) {
      onVinFull?.({ vinLast6: vinLast6FromFullVin(fullVin), fullVin: normalized })
    }
  }, [fullVin, onVinFull])

  useEffect(() => {
    if (mode !== 'decode' || disabled) return

    const normalized = normalizeVinInput(fullVin)
    if (normalized.length !== 17) return
    if (normalized === lastDecodeVin.current) return

    const generation = ++decodeGen.current
    const timer = window.setTimeout(() => {
      void (async () => {
        setMessage(null)
        setPending(true)
        onPendingChange?.(true)
        try {
          const result = await decodeVinForDemand(fullVin)
          if (generation !== decodeGen.current) return
          if ('error' in result) {
            onDecodeFailed?.({ vinLast6: vinLast6FromFullVin(fullVin), error: result.error })
            setMessage({ type: 'error', text: result.error })
            return
          }
          onDecoded?.(result.fields, result.hint, result.markVinDecodeWarning)
          lastDecodeVin.current = normalized
          const parts: string[] = ['Vehicle fields updated from VIN.']
          if (result.hint) parts.push(result.hint)
          setMessage({
            type: result.markVinDecodeWarning || result.hint ? 'warning' : 'success',
            text: parts.join(' '),
          })
        } finally {
          setPending(false)
          onPendingChange?.(false)
        }
      })()
    }, 600)

    return () => window.clearTimeout(timer)
  }, [fullVin, mode, disabled, onDecoded, onDecodeFailed, onPendingChange])

  async function handleRetry() {
    if (mode !== 'decode') return
    const generation = ++decodeGen.current
    setPending(true)
    onPendingChange?.(true)
    try {
      const result = await decodeVinForDemand(fullVin)
      if (generation !== decodeGen.current) return
      if ('error' in result) {
        onDecodeFailed?.({ vinLast6: vinLast6FromFullVin(fullVin), error: result.error })
        setMessage({ type: 'error', text: result.error })
      } else {
        onDecoded?.(result.fields, result.hint, result.markVinDecodeWarning)
        setMessage({ type: 'success', text: 'Vehicle fields updated from VIN.' })
      }
    } finally {
      setPending(false)
      onPendingChange?.(false)
    }
  }

  const captureHint =
    'Vehicle details are decoded automatically after you create the appointment — nothing to wait for here.'

  return (
    <div className="sm:col-span-2 space-y-2 rounded-lg border border-zinc-300/80 dark:border-gray-700 bg-zinc-50/80 dark:bg-black/20 p-3">
      <label className="block text-sm font-medium text-zinc-700 dark:text-gray-300">
        Full VIN{' '}
        <span className="font-normal text-zinc-500">
          ({mode === 'capture' ? '17 characters — saved on the demand' : '17 characters — decodes here'})
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          name={undefined}
          value={fullVin}
          onChange={(e) => setFullVin(normalizeVinInput(e.target.value).slice(0, 17))}
          disabled={disabled}
          placeholder="e.g. 2HGFC2F59KH501234"
          autoComplete="off"
          className={`flex-1 min-w-[12rem] font-mono uppercase rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50 ${inputClassName}`}
        />
        {mode === 'decode' && message?.type === 'error' ? (
          <button
            type="button"
            disabled={disabled || pending || fullVin.length < 17}
            onClick={() => void handleRetry()}
            className={`shrink-0 rounded-md border border-zinc-400/60 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5 disabled:opacity-50 ${buttonClassName}`}
          >
            {pending ? 'Decoding…' : 'Retry'}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-zinc-500 dark:text-gray-500">
        {mode === 'capture' ? captureHint : 'NHTSA lookup via server.'}
        {mode === 'decode' && pending ? ' (lookup in progress…)' : null}
      </p>
      {mode === 'decode' && message ? (
        <p
          className={`text-xs ${
            message.type === 'error'
              ? 'text-red-600 dark:text-red-300'
              : message.type === 'warning'
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-green-700 dark:text-green-300'
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  )
}