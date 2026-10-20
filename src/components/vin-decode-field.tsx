'use client'

import { useState } from 'react'
import { decodeVinForDemand } from '@/lib/vin-decode/decode-vin-action'
import type { DemandVehicleFieldsFromVin } from '@/lib/vin-decode/map-to-demand-vehicle'
import { mapVinDecodeToDemandFields } from '@/lib/vin-decode/map-to-demand-vehicle'
import { decodeVinFromNhtsa, normalizeVinInput } from '@/lib/vin-decode/nhtsa-vpic'

function isLikelyBrowserFetchFailure(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  const msg = e.message.toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('cors') ||
    e.name === 'TypeError'
  )
}

export type VinDecodeApplyHandlers = {
  setVinLast6: (value: string) => void
  setVehicleYear: (value: string) => void
  setSelectedMake: (value: string) => void
  setSelectedModel: (value: string) => void
  setSelectedTrim: (value: string) => void
  setCustomModel: (value: string) => void
}

type VinDecodeFieldProps = {
  disabled?: boolean
  onDecoded: (fields: DemandVehicleFieldsFromVin, hint?: string) => void
  inputClassName?: string
  buttonClassName?: string
}

export function VinDecodeField({
  disabled = false,
  onDecoded,
  inputClassName = '',
  buttonClassName = '',
}: VinDecodeFieldProps) {
  const [fullVin, setFullVin] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | 'warning'; text: string } | null>(
    null
  )

  async function handleDecode() {
    setMessage(null)
    const normalized = normalizeVinInput(fullVin)
    if (normalized.length !== 17) {
      setMessage({ type: 'error', text: 'Enter the full 17-character VIN before decoding.' })
      return
    }

    setPending(true)
    try {
      const decode = await decodeVinFromNhtsa(fullVin)
      const fields = mapVinDecodeToDemandFields(fullVin, decode)

      let hint: string | undefined
      if (fields.makeUnmapped) {
        hint = `Make "${fields.rawMake}" is not in the dropdown — select make manually.`
      } else if (!fields.selectedModel && fields.rawModel) {
        hint = `Model "${fields.rawModel}" could not be matched — use Other or pick from the list.`
      }

      onDecoded(fields, hint)

      const parts: string[] = ['Vehicle fields updated from VIN.']
      if (hint) parts.push(hint)
      setMessage({
        type: hint ? 'warning' : 'success',
        text: parts.join(' '),
      })
    } catch (e) {
      if (isLikelyBrowserFetchFailure(e)) {
        const result = await decodeVinForDemand(fullVin)
        if ('error' in result) {
          setMessage({ type: 'error', text: result.error })
        } else {
          onDecoded(result.fields, result.hint)
          const parts: string[] = ['Vehicle fields updated from VIN.']
          if (result.hint) parts.push(result.hint)
          setMessage({
            type: result.hint ? 'warning' : 'success',
            text: parts.join(' '),
          })
        }
      } else {
        const text = e instanceof Error ? e.message : 'VIN decode failed'
        setMessage({ type: 'error', text })
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="sm:col-span-2 space-y-2 rounded-lg border border-zinc-300/80 dark:border-gray-700 bg-zinc-50/80 dark:bg-black/20 p-3">
      <label className="block text-sm font-medium text-zinc-700 dark:text-gray-300">
        Full VIN <span className="font-normal text-zinc-500">(17 characters, optional — auto-fill)</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={fullVin}
          onChange={(e) => setFullVin(normalizeVinInput(e.target.value).slice(0, 17))}
          disabled={disabled || pending}
          placeholder="e.g. 4S4BSACCXH3331708"
          autoComplete="off"
          className={`flex-1 min-w-[12rem] font-mono uppercase rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50 ${inputClassName}`}
        />
        <button
          type="button"
          disabled={disabled || pending || fullVin.length < 17}
          onClick={() => void handleDecode()}
          className={`shrink-0 rounded-md border border-[#C27E00]/50 px-4 py-2 text-sm font-medium text-[#C27E00] hover:bg-[#C27E00]/10 disabled:opacity-50 ${buttonClassName}`}
        >
          {pending ? 'Decoding…' : 'Decode VIN'}
        </button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-gray-500">
        Uses US NHTSA vPIC (works for most Canadian VINs). Only the last 6 digits are saved on the demand.
      </p>
      {message && (
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
      )}
    </div>
  )
}
