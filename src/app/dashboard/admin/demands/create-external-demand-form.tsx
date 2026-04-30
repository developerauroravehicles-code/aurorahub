'use client'

import { useActionState, useState, useEffect } from 'react'
import { createExternalDemand } from './create-external-demand-actions'
import { getCameraModelsForDealer } from './get-cameras-for-dealer'
import { VEHICLE_MAKES_CA } from '@/lib/vehicle-makes'
import { getModelsForMake, getTrimsForModel } from '@/lib/vehicle-models'
import { CanadianPhoneInput } from '@/components/canadian-phone-input'

interface Dealer {
  id: string
  name: string
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
  const [selectedMake, setSelectedMake] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedTrim, setSelectedTrim] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [selectedCamera, setSelectedCamera] = useState('')
  const [customCamera, setCustomCamera] = useState('')
  const [isFutureCustomer, setIsFutureCustomer] = useState(false)
  const [completeOnCreate, setCompleteOnCreate] = useState(false)

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

        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Date *</label>
          <input
            name="appointmentDate"
            type="date"
            required
            className={inputClass}
          />
          <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">
            Past dates allowed. The date is saved as noon in the dealer&apos;s region timezone (falls back to Pacific if none).
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
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">First Name *</label>
          <input
            key={isFutureCustomer ? 'fn-future' : 'fn-normal'}
            name="firstName"
            required
            value={isFutureCustomer ? 'Future' : undefined}
            readOnly={isFutureCustomer}
            className={isFutureCustomer ? inputReadOnlyClass : inputClass}
            placeholder={isFutureCustomer ? '' : undefined}
            style={!isFutureCustomer ? { textTransform: 'uppercase' } : undefined}
            onInput={!isFutureCustomer ? (e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase() } : undefined}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Last Name *</label>
          <input
            key={isFutureCustomer ? 'ln-future' : 'ln-normal'}
            name="lastName"
            required
            value={isFutureCustomer ? 'Customer' : undefined}
            readOnly={isFutureCustomer}
            className={isFutureCustomer ? inputReadOnlyClass : inputClass}
            placeholder={isFutureCustomer ? '' : undefined}
            style={!isFutureCustomer ? { textTransform: 'uppercase' } : undefined}
            onInput={!isFutureCustomer ? (e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase() } : undefined}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Phone *</label>
          {isFutureCustomer ? (
            <input
              key="ph-future"
              name="phone"
              type="tel"
              required
              value="000 - 000 - 0000"
              readOnly
              className={inputReadOnlyClass}
            />
          ) : (
            <CanadianPhoneInput
              key="ph-normal"
              name="phone"
              required
              placeholder="416 - 123 - 4567"
              className={inputClass}
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Address</label>
          <input
            key={isFutureCustomer ? 'addr-future' : 'addr-normal'}
            name="address"
            value={isFutureCustomer ? 'Future' : undefined}
            readOnly={isFutureCustomer}
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
          <input name="vehicleYear" type="number" min={1900} max={2100} required className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Stock Number *</label>
          <input name="stockNumber" required className={inputClass} placeholder="Stock number" style={{ textTransform: 'uppercase' }} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase() }} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">VIN Last 6 Digits <span className="text-red-400">*</span></label>
          <input
            name="vinLast6"
            required
            minLength={6}
            className={inputClass}
            placeholder="Last 6 digits"
            style={{ textTransform: 'uppercase' }}
            onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase() }}
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
