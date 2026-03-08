'use client'

import { useActionState, useState, useEffect } from 'react'
import { createExternalDemand } from './create-external-demand-actions'
import { getCameraModelsForDealer } from './get-cameras-for-dealer'
import { VEHICLE_MAKES_CA } from '@/lib/vehicle-makes'
import { getModelsForMake, getTrimsForModel } from '@/lib/vehicle-models'

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

const inputClass = 'mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white'
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

  const today = new Date().toISOString().split('T')[0]

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-white border-b border-gray-800 pb-2">Create External Demand</h2>
        <p className="text-sm text-gray-400 mt-1">External demands do not affect calendar time slots. No time selection required.</p>
      </div>

      {state?.error && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 p-3 rounded-md text-sm">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-300">Dealer *</label>
          <select
            name="dealerId"
            value={selectedDealerId}
            onChange={(e) => setSelectedDealerId(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">-- Select dealer --</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id} className="bg-black">{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Date *</label>
          <input
            name="appointmentDate"
            type="date"
            required
            min={today}
            className={inputClass}
          />
          <p className="text-xs text-gray-500 mt-1">Date only - no time slot. Does not affect calendar.</p>
        </div>

        {specialists.length > 0 && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-300">Specialist</label>
            <select name="assignedSpecialistId" className={inputClass}>
              <option value="" className="bg-black">-- No specialist assigned --</option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id} className="bg-black">
                  {s.full_name || 'Unknown'}
                </option>
              ))}
            </select>
          </div>
        )}

        <h3 className="col-span-full text-sm font-medium text-white border-t border-gray-800 pt-4 mt-4">Customer</h3>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="futureCustomer"
            checked={isFutureCustomer}
            onChange={(e) => setIsFutureCustomer(e.target.checked)}
            className="rounded border-gray-600 bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-0"
          />
          <label htmlFor="futureCustomer" className="text-sm font-medium text-gray-300 cursor-pointer">
            Future Customer
          </label>
          <span className="text-xs text-gray-500">— When checked, customer info is set to &quot;Future&quot;</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">First Name *</label>
          <input
            key={isFutureCustomer ? 'fn-future' : 'fn-normal'}
            name="firstName"
            required
            value={isFutureCustomer ? 'Future' : undefined}
            readOnly={isFutureCustomer}
            className={isFutureCustomer ? inputReadOnlyClass : inputClass}
            placeholder={isFutureCustomer ? '' : undefined}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Last Name *</label>
          <input
            key={isFutureCustomer ? 'ln-future' : 'ln-normal'}
            name="lastName"
            required
            value={isFutureCustomer ? 'Customer' : undefined}
            readOnly={isFutureCustomer}
            className={isFutureCustomer ? inputReadOnlyClass : inputClass}
            placeholder={isFutureCustomer ? '' : undefined}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Phone *</label>
          <input
            key={isFutureCustomer ? 'ph-future' : 'ph-normal'}
            name="phone"
            type="tel"
            required
            value={isFutureCustomer ? '000-000-0000' : undefined}
            readOnly={isFutureCustomer}
            placeholder={!isFutureCustomer ? '(604) 833-5801' : undefined}
            className={isFutureCustomer ? inputReadOnlyClass : inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Address</label>
          <input
            key={isFutureCustomer ? 'addr-future' : 'addr-normal'}
            name="address"
            value={isFutureCustomer ? 'Future' : undefined}
            readOnly={isFutureCustomer}
            className={isFutureCustomer ? inputReadOnlyClass : inputClass}
            placeholder={!isFutureCustomer ? 'Optional' : undefined}
          />
        </div>

        <h3 className="col-span-full text-sm font-medium text-white border-t border-gray-800 pt-4 mt-4">Vehicle</h3>
        <div>
          <label className="block text-sm font-medium text-gray-300">Make *</label>
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
              <option key={m} value={m} className="bg-black">{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Model *</label>
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
                  <option key={m} value={m} className="bg-black">{m}</option>
                ))}
                <option value="__custom__" className="bg-black">Other</option>
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
                        <option key={t} value={t} className="bg-black">{t}</option>
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
          <label className="block text-sm font-medium text-gray-300">Year *</label>
          <input name="vehicleYear" type="number" min={1900} max={2100} required className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Stock Number *</label>
          <input name="stockNumber" required className={inputClass} placeholder="Stock number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">VIN Last 6 Digits <span className="text-red-400">*</span></label>
          <input
            name="vinLast6"
            required
            minLength={6}
            className={inputClass}
            placeholder="Last 6 digits"
          />
        </div>

        <h3 className="col-span-full text-sm font-medium text-white border-t border-gray-800 pt-4 mt-4">Camera</h3>
        <div>
          <label className="block text-sm font-medium text-gray-300">Camera Model *</label>
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
                  <option key={c.id} value={c.name} className="bg-black">{c.name}</option>
                ))}
                <option value="__custom__" className="bg-black">Other</option>
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
          <label className="block text-sm font-medium text-gray-300">Comment</label>
          <textarea name="comment" rows={2} className={inputClass} placeholder="Optional" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white border border-gray-700 rounded-md"
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
