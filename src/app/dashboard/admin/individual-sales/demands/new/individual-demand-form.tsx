'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createIndividualDemand, type CreateIndividualDemandState } from './actions'
import { CanadianPhoneInput } from '@/components/canadian-phone-input'
import { VinDecodeField } from '@/components/vin-decode-field'
import { VinManualVehicleFields } from '@/components/vin-manual-vehicle-fields'
import type { DemandVehicleFieldsFromVin } from '@/lib/vin-decode/map-to-demand-vehicle'
import { INDIVIDUAL_SALES_DEMANDS } from '@/lib/individual-sales'

interface CameraModel {
  id: string
  name: string
  label?: string
}

interface Specialist {
  id: string
  full_name: string | null
}

const inputClass =
  'mt-1 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-zinc-900 dark:text-white'

function displayVehicleModel(fields: DemandVehicleFieldsFromVin): string {
  if (fields.selectedModel === '__custom__' && fields.customModel) {
    return fields.customModel
  }
  const base = fields.selectedModel || fields.rawModel
  return fields.selectedTrim ? `${base} (${fields.selectedTrim})` : base
}

export function IndividualDemandForm({
  cameraModels,
  specialists,
  defaultAddress,
}: {
  cameraModels: CameraModel[]
  specialists: Specialist[]
  defaultAddress?: string
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createIndividualDemand, null as CreateIndividualDemandState)
  const [phone, setPhone] = useState('')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [vinLast6, setVinLast6] = useState('')
  const [vinDecodeWarning, setVinDecodeWarning] = useState(false)
  const [vinDecodePending, setVinDecodePending] = useState(false)

  useEffect(() => {
    if (state?.success && state.demandId) {
      const returnQs = encodeURIComponent(INDIVIDUAL_SALES_DEMANDS)
      router.push(`/dashboard/admin/demands/${state.demandId}?return=${returnQs}`)
    }
  }, [state, router])

  const onVinDecoded = (fields: DemandVehicleFieldsFromVin) => {
    setVinDecodeWarning(false)
    setVinLast6(fields.vinLast6)
    setVehicleYear(fields.vehicleYear)
    setVehicleMake(fields.selectedMake || fields.rawMake)
    setVehicleModel(displayVehicleModel(fields))
  }

  const onVinDecodeFailed = (payload: { vinLast6: string }) => {
    setVinDecodeWarning(true)
    setVinLast6(payload.vinLast6)
    setVehicleYear('')
    setVehicleMake('')
    setVehicleModel('')
  }

  const vehicleReady =
    vinLast6.length >= 6 && !!vehicleMake.trim() && !!vehicleModel.trim() && !!vehicleYear.trim()

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {state?.error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-gray-300">First name</label>
          <input name="firstName" required className={inputClass} />
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-gray-300">Last name</label>
          <input name="lastName" required className={inputClass} />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-700 dark:text-gray-300">Phone</label>
        <CanadianPhoneInput name="phone" value={phone} onChange={setPhone} required />
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-700 dark:text-gray-300">Address</label>
        <input name="address" defaultValue={defaultAddress ?? ''} className={inputClass} />
      </div>

      <VinDecodeField
        disabled={isPending}
        onDecoded={onVinDecoded}
        onDecodeFailed={onVinDecodeFailed}
        onPendingChange={setVinDecodePending}
        inputClassName={inputClass}
      />

      <input type="hidden" name="vehicleMake" value={vehicleMake} />
      <input type="hidden" name="vehicleModel" value={vehicleModel} />
      <input type="hidden" name="vehicleYear" value={vehicleYear} />
      <input type="hidden" name="vinLast6" value={vinLast6} />
      <input type="hidden" name="vinDecodeWarning" value={vinDecodeWarning ? '1' : '0'} />

      {vinDecodeWarning ? (
        <VinManualVehicleFields
          vehicleYear={vehicleYear}
          vehicleMake={vehicleMake}
          vehicleModel={vehicleModel}
          onVehicleYear={setVehicleYear}
          onVehicleMake={setVehicleMake}
          onVehicleModel={setVehicleModel}
          inputClassName={inputClass}
          disabled={isPending}
        />
      ) : vehicleReady ? (
        <p className="text-xs text-zinc-500 dark:text-gray-400">
          {vehicleYear} {vehicleMake} {vehicleModel} · VIN …{vinLast6}
        </p>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-gray-400">Enter the full 17-character VIN to continue.</p>
      )}

      <div>
        <label className="text-sm font-medium text-zinc-700 dark:text-gray-300">Stock number (optional)</label>
        <input name="stockNumber" className={inputClass} />
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-700 dark:text-gray-300">Camera model</label>
        <select name="cameraModel" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Select camera
          </option>
          {cameraModels.map((c) => (
            <option key={c.id} value={c.name}>
              {c.label ?? c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-700 dark:text-gray-300">Appointment (Pacific Time)</label>
        <input type="datetime-local" name="appointmentAtLocal" required className={inputClass} />
        <p className="mt-1 text-xs text-zinc-500 dark:text-gray-400">
          No dealer calendar — any future time. Customer and specialist SMS use the standard appointment flow.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-700 dark:text-gray-300">Specialist (optional)</label>
        <select name="assignedSpecialistId" className={inputClass} defaultValue="">
          <option value="">Auto-assign</option>
          {specialists.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name ?? s.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-700 dark:text-gray-300">Comment</label>
        <textarea name="comment" rows={2} className={inputClass} />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || vinDecodePending || !vehicleReady}
          className="rounded-md bg-[#C27E00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a06900] disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create appointment'}
        </button>
        <Link href={INDIVIDUAL_SALES_DEMANDS} className="text-sm text-zinc-600 hover:text-[#C27E00] dark:text-gray-400">
          Cancel
        </Link>
      </div>
    </form>
  )
}