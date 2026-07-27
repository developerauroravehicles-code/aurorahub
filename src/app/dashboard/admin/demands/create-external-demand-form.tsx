'use client'

import { useActionState, useState, useEffect, useMemo } from 'react'
import { createExternalDemand } from './create-external-demand-actions'
import { getCameraModelsForDealer } from './get-cameras-for-dealer'
import { VEHICLE_MAKES_CA } from '@/lib/vehicle-makes'
import { getModelsForMake, getTrimsForModel } from '@/lib/vehicle-models'
import { CanadianPhoneInput } from '@/components/canadian-phone-input'
import { DemandDocumentFillButton } from '@/components/demand-document-fill-button'
import { AppointmentCalendar } from '@/components/appointment-calendar'
import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone } from '@/lib/timezone-defaults'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import {
  DemandServiceType,
  REMOVAL_FEE_CAD,
  SERVICE_TYPE_LABELS,
  TRANSFER_FEE_CAD,
} from '@/lib/demand-pricing'

interface Dealer {
  id: string
  name: string
  region_codes?: { timezone_id?: unknown; timezones?: { name: string } | Array<{ name: string }> } | Array<{
    timezone_id?: unknown
    timezones?: { name: string } | Array<{ name: string }>
  }> | null
}

interface CameraModel {
  id: string
  name: string
}

interface Specialist {
  id: string
  full_name: string | null
}

interface CreateExternalDemandFormProps {
  dealers: Dealer[]
  specialists: Specialist[]
  onSuccess?: () => void
  onCancel?: () => void
}

const inputClass =
  'mt-1 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500'
const inputReadOnlyClass = inputClass + ' opacity-75 cursor-not-allowed'

export function CreateExternalDemandForm({ dealers, specialists, onSuccess, onCancel }: CreateExternalDemandFormProps) {
  const [state, formAction, isPending] = useActionState(createExternalDemand, null)
  const [selectedDealerId, setSelectedDealerId] = useState<string>(dealers[0]?.id ?? '')

  useEffect(() => {
    if (dealers.length > 0 && !selectedDealerId) {
      setSelectedDealerId(dealers[0].id)
    }
  }, [dealers])

  const [cameraModels, setCameraModels] = useState<CameraModel[]>([])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [stockNumber, setStockNumber] = useState('')
  const [vinLast6, setVinLast6] = useState('')
  const [selectedMake, setSelectedMake] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedTrim, setSelectedTrim] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [selectedCamera, setSelectedCamera] = useState('')
  const [customCamera, setCustomCamera] = useState('')
  const [isFutureCustomer, setIsFutureCustomer] = useState(false)
  const [completeOnCreate, setCompleteOnCreate] = useState(false)
  const [serviceType, setServiceType] = useState<DemandServiceType>('installation')
  const [appointmentDate, setAppointmentDate] = useState('')

  const selectedDealer = dealers.find((d) => d.id === selectedDealerId)
  const dealerTimezone = useMemo(
    () =>
      getEffectiveTimezone(
        getTimezoneFromDealer(selectedDealer as Parameters<typeof getTimezoneFromDealer>[0])
      ),
    [selectedDealer]
  )

  useEffect(() => {
    if (selectedDealerId) {
      getCameraModelsForDealer(selectedDealerId).then(setCameraModels)
    } else {
      setCameraModels([])
    }
  }, [selectedDealerId])

  useEffect(() => {
    if (state?.success) {
      onSuccess?.()
    }
  }, [state?.success, onSuccess])

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-gray-800 pb-2">Create External Demand</h2>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">Date only — no slot. External demands do not affect normal demand slots. Past dates allowed for retroactive entry.</p>
      </div>

      {state?.error && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 p-3 rounded-md text-sm">
          {state.error}
        </div>
      )}

      {!isFutureCustomer && (
        <DemandDocumentFillButton
          disabled={isPending}
          currentValues={{
            firstName,
            lastName,
            phone,
            vehicleYear,
            stockNumber,
            vinLast6,
            selectedMake,
            selectedModel,
            customModel,
          }}
          setters={{
            setFirstName,
            setLastName,
            setPhone,
            setVehicleYear,
            setStockNumber,
            setVinLast6,
            setSelectedMake,
            setSelectedModel,
            setSelectedTrim,
            setCustomModel,
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Dealer *</label>
          <select
            name="dealerId"
            value={selectedDealerId}
            onChange={(e) => setSelectedDealerId(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">-- Select dealer --</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Date *</label>
          <AppointmentCalendar
            timezoneName={dealerTimezone}
            allowPastDates
            selectedPacificYmd={appointmentDate || null}
            onDateSelect={(date) => {
              setAppointmentDate(formatInTimeZone(date, dealerTimezone, 'yyyy-MM-dd'))
            }}
            getTakenSlots={async () => []}
          />
          <input type="hidden" name="appointmentDate" value={appointmentDate} required />
          <p className="text-xs text-zinc-500 dark:text-gray-500 mt-2">
            Calendar uses the selected dealer&apos;s region timezone ({dealerTimezone}). Past dates are allowed.
            Saved as noon on that day in the dealer region so the date does not shift.
          </p>
        </div>

        {specialists.length > 0 && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Specialist</label>
            <select name="assignedSpecialistId" className={inputClass}>
              <option value="" className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                -- No specialist assigned --
              </option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                  {s.full_name || 'Unknown'}
                </option>
              ))}
            </select>
          </div>
        )}

        <h3 className="col-span-full text-sm font-medium text-zinc-900 dark:text-white border-t border-zinc-200 dark:border-gray-800 pt-4 mt-4">Customer</h3>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="futureCustomer"
            checked={isFutureCustomer}
            onChange={(e) => setIsFutureCustomer(e.target.checked)}
            className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-0"
          />
          <label htmlFor="futureCustomer" className="text-sm font-medium text-zinc-600 dark:text-gray-300 cursor-pointer">
            Future Customer
          </label>
          <span className="text-xs text-zinc-500 dark:text-gray-500">— When checked, customer info is set to &quot;Future&quot;</span>
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="completeOnCreate"
            checked={completeOnCreate}
            onChange={(e) => setCompleteOnCreate(e.target.checked)}
            className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-0"
          />
          <label htmlFor="completeOnCreate" className="text-sm font-medium text-zinc-600 dark:text-gray-300 cursor-pointer">
            Mark as completed on creation
          </label>
          <span className="text-xs text-zinc-500 dark:text-gray-500">— When checked, demand is created directly as completed</span>
        </div>
        {completeOnCreate && <input type="hidden" name="completeOnCreate" value="true" />}
        {completeOnCreate && (
          <div className="sm:col-span-2 space-y-2">
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Service type *</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  { value: 'installation' as const, hint: 'Dealer camera price' },
                  { value: 'transfer' as const, hint: `Transfer fee — $${TRANSFER_FEE_CAD} CAD` },
                  { value: 'removal' as const, hint: `Removal fee — $${REMOVAL_FEE_CAD} CAD` },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm ${
                    serviceType === opt.value
                      ? 'border-[#C27E00]/60 bg-[#C27E00]/10'
                      : 'border-zinc-300 dark:border-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="serviceType"
                    value={opt.value}
                    checked={serviceType === opt.value}
                    onChange={() => setServiceType(opt.value)}
                    className="mt-0.5 text-[#C27E00] focus:ring-[#C27E00]"
                  />
                  <span>
                    <span className="block font-medium text-zinc-900 dark:text-white">{SERVICE_TYPE_LABELS[opt.value]}</span>
                    <span className="block text-xs text-zinc-500 dark:text-gray-500">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">First Name *</label>
          <input
            name="firstName"
            required
            value={isFutureCustomer ? 'Future' : firstName}
            readOnly={isFutureCustomer}
            onChange={!isFutureCustomer ? (e) => setFirstName(e.target.value.toUpperCase()) : undefined}
            className={isFutureCustomer ? inputReadOnlyClass : inputClass}
            placeholder={isFutureCustomer ? '' : undefined}
            style={!isFutureCustomer ? { textTransform: 'uppercase' } : undefined}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Last Name *</label>
          <input
            name="lastName"
            required
            value={isFutureCustomer ? 'Customer' : lastName}
            readOnly={isFutureCustomer}
            onChange={!isFutureCustomer ? (e) => setLastName(e.target.value.toUpperCase()) : undefined}
            className={isFutureCustomer ? inputReadOnlyClass : inputClass}
            placeholder={isFutureCustomer ? '' : undefined}
            style={!isFutureCustomer ? { textTransform: 'uppercase' } : undefined}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Phone *</label>
          {isFutureCustomer ? (
            <input
              name="phone"
              type="tel"
              required
              value="000 - 000 - 0000"
              readOnly
              className={inputReadOnlyClass}
            />
          ) : (
            <CanadianPhoneInput
              name="phone"
              required
              value={phone}
              onChange={setPhone}
              placeholder="416 - 123 - 4567"
              className={inputClass}
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Address</label>
          <input
            name="address"
            value={isFutureCustomer ? 'Future' : address}
            readOnly={isFutureCustomer}
            onChange={!isFutureCustomer ? (e) => setAddress(e.target.value) : undefined}
            className={isFutureCustomer ? inputReadOnlyClass : inputClass}
            placeholder={!isFutureCustomer ? 'Optional' : undefined}
          />
        </div>

        <h3 className="col-span-full text-sm font-medium text-zinc-900 dark:text-white border-t border-zinc-200 dark:border-gray-800 pt-4 mt-4">Vehicle</h3>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Make *</label>
          <select
            name="vehicleMake"
            value={selectedMake}
            onChange={(e) => {
              setSelectedMake(e.target.value)
              setSelectedModel('')
              setSelectedTrim('')
              setCustomModel('')
            }}
            required
            className={inputClass}
          >
            <option value="">-- Select --</option>
            {VEHICLE_MAKES_CA.map((m) => (
              <option key={m} value={m} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Model *</label>
          {selectedMake ? (
            <div className="space-y-1">
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value)
                  setSelectedTrim('')
                  setCustomModel(e.target.value === '__custom__' ? customModel : '')
                }}
                required={selectedModel !== '__custom__'}
                className={inputClass}
              >
                <option value="">-- Select --</option>
                {getModelsForMake(selectedMake).map((m) => (
                  <option key={m} value={m} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                    {m}
                  </option>
                ))}
                <option value="__custom__" className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                  Other
                </option>
              </select>
              {selectedModel === '__custom__' && (
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="Model name"
                  required
                  name="vehicleModel"
                  className={inputClass}
                />
              )}
              {selectedModel && selectedModel !== '__custom__' && (
                <>
                  {getTrimsForModel(selectedMake, selectedModel).length > 0 ? (
                    <select
                      value={selectedTrim}
                      onChange={(e) => setSelectedTrim(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">-- Trim (optional) --</option>
                      {getTrimsForModel(selectedMake, selectedModel).map((t) => (
                        <option key={t} value={t} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                          {t}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    type="hidden"
                    name="vehicleModel"
                    value={selectedTrim ? `${selectedModel} (${selectedTrim})` : selectedModel}
                  />
                </>
              )}
            </div>
          ) : (
            <input readOnly placeholder="Select make first" className={`${inputClass} opacity-50 cursor-not-allowed`} />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Year *</label>
          <input name="vehicleYear" type="number" min={1900} max={2100} required value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Stock Number *</label>
          <input name="stockNumber" required value={stockNumber} onChange={(e) => setStockNumber(e.target.value.toUpperCase())} className={inputClass} placeholder="Stock number" style={{ textTransform: 'uppercase' }} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">VIN Last 6 Digits <span className="text-red-400">*</span></label>
          <input
            name="vinLast6"
            required
            minLength={6}
            value={vinLast6}
            onChange={(e) => setVinLast6(e.target.value.toUpperCase())}
            className={inputClass}
            placeholder="Last 6 digits"
            style={{ textTransform: 'uppercase' }}
          />
        </div>

        <h3 className="col-span-full text-sm font-medium text-zinc-900 dark:text-white border-t border-zinc-200 dark:border-gray-800 pt-4 mt-4">Camera</h3>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Camera Model *</label>
          {cameraModels.length > 0 ? (
            <div className="space-y-1">
              <select
                value={selectedCamera}
                onChange={(e) => {
                  setSelectedCamera(e.target.value)
                  setCustomCamera('')
                }}
                required
                className={inputClass}
              >
                <option value="">-- Select --</option>
                {cameraModels.map((c) => (
                  <option key={c.id} value={c.name} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                    {c.name}
                  </option>
                ))}
                <option value="__custom__" className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                  Other
                </option>
              </select>
              {selectedCamera === '__custom__' && (
                <input
                  type="text"
                  value={customCamera}
                  onChange={(e) => setCustomCamera(e.target.value)}
                  placeholder="Camera model"
                  required
                  name="cameraModel"
                  className={inputClass}
                />
              )}
              {selectedCamera && selectedCamera !== '__custom__' && (
                <input type="hidden" name="cameraModel" value={selectedCamera} />
              )}
            </div>
          ) : (
            <input name="cameraModel" required className={inputClass} placeholder="Enter camera model" />
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Comment</label>
          <textarea name="comment" rows={2} className={inputClass} placeholder="Optional" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-gray-800">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-gray-300 hover:text-zinc-900 dark:text-white border border-zinc-300 dark:border-gray-700 rounded-md"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-[#C27E00] hover:bg-[#a06900] rounded-md disabled:opacity-50"
        >
          {isPending ? 'Creating...' : 'Create External Demand'}
        </button>
      </div>
    </form>
  )
}
