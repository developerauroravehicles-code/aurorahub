'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { VinDecodeField } from '@/components/vin-decode-field'
import { VinDecodeWarningBadge } from '@/components/vin-decode-warning-badge'
import type { DemandVehicleFieldsFromVin } from '@/lib/vin-decode/map-to-demand-vehicle'
import { updateDemandVehicleFromVinWarning } from './actions'

const inputClass =
  'w-full border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 rounded text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]'

function displayVehicleModel(fields: DemandVehicleFieldsFromVin): string {
  if (fields.selectedModel === '__custom__' && fields.customModel) {
    return fields.customModel
  }
  const base = fields.selectedModel || fields.rawModel
  return fields.selectedTrim ? `${base} (${fields.selectedTrim})` : base
}

type Props = {
  demandId: string
  vehicleYear: number
  vehicleMake: string
  vehicleModel: string
  vinLast6: string | null
  canEdit: boolean
}

export function EditVinDecodeVehicleForm({
  demandId,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  vinLast6,
  canEdit,
}: Props) {
  const router = useRouter()
  const [year, setYear] = useState(String(vehicleYear))
  const [make, setMake] = useState(vehicleMake)
  const [model, setModel] = useState(vehicleModel)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const yearNum = parseInt(year, 10)
  const hasChange =
    yearNum !== vehicleYear ||
    make.trim().toUpperCase() !== vehicleMake.trim().toUpperCase() ||
    model.trim() !== vehicleModel.trim()

  const onVinDecoded = (fields: DemandVehicleFieldsFromVin) => {
    if (fields.vehicleYear) setYear(fields.vehicleYear)
    setMake(fields.selectedMake || fields.rawMake)
    setModel(displayVehicleModel(fields))
  }

  const handleSave = async () => {
    if (!make.trim() || !model.trim() || isNaN(yearNum) || yearNum < 1900) {
      setMessage({ type: 'error', text: 'Enter valid year, make, and model.' })
      return
    }
    setSaving(true)
    setMessage(null)
    const result = await updateDemandVehicleFromVinWarning(demandId, {
      vehicleYear: yearNum,
      vehicleMake: make.trim().toUpperCase(),
      vehicleModel: model.trim(),
    })
    setSaving(false)
    if (result.success) {
      setMessage({ type: 'success', text: 'Vehicle updated — VIN warning cleared.' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Failed to update' })
    }
  }

  if (!canEdit) return null

  return (
    <div className="mt-4 rounded-lg border border-red-300/60 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <VinDecodeWarningBadge />
        <span className="text-sm font-medium text-red-900 dark:text-red-200">
          VIN decode was unreliable — correct vehicle details below.
        </span>
      </div>
      {vinLast6 ? (
        <p className="mb-3 text-xs text-zinc-600 dark:text-gray-400">On file: VIN …{vinLast6.toUpperCase()}</p>
      ) : null}

      <div className="mb-4">
        <VinDecodeField disabled={saving} onDecoded={onVinDecoded} inputClassName={inputClass} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-gray-400">Year</label>
          <input
            type="number"
            min={1900}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-gray-400">Make</label>
          <input
            value={make}
            onChange={(e) => setMake(e.target.value.toUpperCase())}
            className={inputClass}
            style={{ textTransform: 'uppercase' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-gray-400">Model</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !hasChange}
          className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          {saving ? 'Saving…' : 'Save vehicle & clear warning'}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-sm ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}