'use client'

import { useState, useEffect } from 'react'
import { updateDemand, revertDemandToPending } from './actions'
import { getAvailableSlotsForEdit } from '@/app/dashboard/system-management/calendar/actions'
import { useRouter } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { VEHICLE_MAKES_CA } from '@/lib/vehicle-makes'
import { getModelsForMake, getTrimsForModel } from '@/lib/vehicle-models'

function parseModelAndTrim(val: string): { model: string; trim: string } {
  const m = val?.match(/^(.+?)\s*\(([^)]+)\)$/)
  return m ? { model: m[1].trim(), trim: m[2].trim() } : { model: val || '', trim: '' }
}

interface Demand {
  id: string
  demand_number?: number | string
  dealer_id?: string | null
  customer_firstname: string
  customer_lastname: string
  customer_phone: string
  customer_address: string | null
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  stock_number: string | null
  camera_model: string
  appointment_date: string
}

interface EditDemandModalProps {
  demand: Demand
  isOpen: boolean
  onClose: () => void
}

export function EditDemandModal({ demand, isOpen, onClose }: EditDemandModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    customer_firstname: demand.customer_firstname,
    customer_lastname: demand.customer_lastname,
    customer_phone: demand.customer_phone,
    customer_address: demand.customer_address || '',
    vehicle_make: demand.vehicle_make,
    vehicle_model: demand.vehicle_model,
    vehicle_year: demand.vehicle_year,
    stock_number: demand.stock_number || '',
    camera_model: demand.camera_model,
  })
  const initialAppointment = new Date(demand.appointment_date)
  const [selectedDate, setSelectedDate] = useState(() => formatInTimeZone(initialAppointment, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd'))
  const [selectedSlot, setSelectedSlot] = useState<string>(() => demand.appointment_date)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [slotsTimezone, setSlotsTimezone] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFormData({
        customer_firstname: demand.customer_firstname,
        customer_lastname: demand.customer_lastname,
        customer_phone: demand.customer_phone,
        customer_address: demand.customer_address || '',
        vehicle_make: demand.vehicle_make,
        vehicle_model: demand.vehicle_model,
        vehicle_year: demand.vehicle_year,
        stock_number: demand.stock_number || '',
        camera_model: demand.camera_model,
      })
      const d = new Date(demand.appointment_date)
      setSelectedDate(formatInTimeZone(d, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd'))
      setSelectedSlot(demand.appointment_date)
      setError(null)
    }
  }, [isOpen, demand])

  useEffect(() => {
    if (!isOpen || !demand.dealer_id) {
      if (!demand.dealer_id) setAvailableSlots([])
      return
    }
    setSlotsLoading(true)
    getAvailableSlotsForEdit(demand.dealer_id, selectedDate, demand.id)
      .then(({ slots, timezoneName }) => {
        setAvailableSlots(slots)
        setSlotsTimezone(timezoneName)
        setSelectedSlot(prev => {
          const prevDate = prev ? formatInTimeZone(new Date(prev), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd') : ''
          if (prevDate === selectedDate && slots.includes(prev)) return prev
          if (slots.length > 0) return slots[0]
          return ''
        })
      })
      .finally(() => setSlotsLoading(false))
  }, [isOpen, demand.dealer_id, demand.id, selectedDate])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      form.append(key, value.toString())
    })
    form.append('appointment_date', selectedSlot)

    const result = await updateDemand(demand.id, form)
    
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.refresh()
      onClose()
    }
  }

  const handleRevertToPending = async () => {
    if (!confirm('Are you sure you want to revert this demand to pending status? This will undo the approval.')) {
      return
    }

    setReverting(true)
    setError(null)

    const result = await revertDemandToPending(demand.id)
    
    if (result?.error) {
      setError(result.error)
      setReverting(false)
    } else {
      router.refresh()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">Edit Demand</h2>
              {demand.demand_number != null && (
                <p className="text-sm text-gray-500 mt-1">Demand ID: <span className="font-medium text-[#C27E00]">#{demand.demand_number}</span></p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-800 text-red-200 p-4 rounded-md mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">First Name *</label>
                <input
                  type="text"
                  value={formData.customer_firstname}
                  onChange={(e) => setFormData({ ...formData, customer_firstname: e.target.value })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={formData.customer_lastname}
                  onChange={(e) => setFormData({ ...formData, customer_lastname: e.target.value })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.customer_address}
                  onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Vehicle Make *</label>
                <select
                  value={formData.vehicle_make}
                  onChange={(e) => {
                    const newMake = e.target.value
                    const models = getModelsForMake(newMake)
                    const { model: baseModel } = parseModelAndTrim(formData.vehicle_model)
                    setFormData({
                      ...formData,
                      vehicle_make: newMake,
                      vehicle_model: models.includes(baseModel) ? baseModel : '',
                    })
                  }}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                >
                  <option value="">-- Select make --</option>
                  {[
                    ...(formData.vehicle_make && !VEHICLE_MAKES_CA.includes(formData.vehicle_make) ? [formData.vehicle_make] : []),
                    ...VEHICLE_MAKES_CA,
                  ].map((make) => (
                    <option key={make} value={make} className="bg-black text-white">
                      {make}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Vehicle Model *</label>
                {formData.vehicle_make ? (
                  <div className="space-y-2">
                    {(() => {
                      const { model: baseModel } = parseModelAndTrim(formData.vehicle_model)
                      const models = getModelsForMake(formData.vehicle_make)
                      const isBaseInList = models.includes(baseModel)
                      return (
                        <>
                          <select
                            value={isBaseInList ? baseModel : (baseModel ? '__custom__' : '')}
                            onChange={(e) => {
                              const v = e.target.value
                              setFormData({
                                ...formData,
                                vehicle_model: v === '__custom__' ? formData.vehicle_model : v,
                              })
                            }}
                            required={!formData.vehicle_model || isBaseInList}
                            className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                          >
                            <option value="">-- Select model --</option>
                            {[
                              ...(baseModel && !isBaseInList ? [baseModel] : []),
                              ...models,
                            ]
                              .filter((m, i, arr) => arr.indexOf(m) === i)
                              .map((model) => (
                                <option key={model} value={model} className="bg-black text-white">
                                  {model}
                                </option>
                              ))}
                            <option value="__custom__" className="bg-black text-white">Other</option>
                          </select>
                          {isBaseInList && getTrimsForModel(formData.vehicle_make, baseModel).length > 0 && (
                            <select
                              value={parseModelAndTrim(formData.vehicle_model).trim}
                              onChange={(e) => setFormData({
                                ...formData,
                                vehicle_model: e.target.value ? `${baseModel} (${e.target.value})` : baseModel,
                              })}
                              className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                            >
                              <option value="">-- Select trim (optional) --</option>
                              {getTrimsForModel(formData.vehicle_make, baseModel).map((trim) => (
                                <option key={trim} value={trim} className="bg-black text-white">
                                  {trim}
                                </option>
                              ))}
                            </select>
                          )}
                          {!isBaseInList && (
                            <input
                              type="text"
                              value={formData.vehicle_model}
                              onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                              placeholder="Enter model name"
                              required
                              className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                            />
                          )}
                        </>
                      )
                    })()}
                  </div>
                ) : (
                  <input
                    type="text"
                    value=""
                    readOnly
                    placeholder="Select make first"
                    className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-gray-500 cursor-not-allowed"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Vehicle Year *</label>
                <input
                  type="number"
                  min="1900"
                  max="2100"
                  value={formData.vehicle_year}
                  onChange={(e) => setFormData({ ...formData, vehicle_year: parseInt(e.target.value) || 0 })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Stock Number</label>
                <input
                  type="text"
                  value={formData.stock_number}
                  onChange={(e) => setFormData({ ...formData, stock_number: e.target.value })}
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Camera Model *</label>
                <input
                  type="text"
                  value={formData.camera_model}
                  onChange={(e) => setFormData({ ...formData, camera_model: e.target.value })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Appointment (Day & Slot) *</label>
                <div className="space-y-3">
                  {!demand.dealer_id ? (
                    <p className="text-sm text-amber-500">Dealer not set; cannot show slots.</p>
                  ) : (
                    <>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Date</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={formatInTimeZone(new Date(), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')}
                      className="w-full max-w-xs border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Time slot</span>
                    {slotsLoading ? (
                      <p className="text-sm text-gray-500">Loading slots…</p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-sm text-amber-500">No available slots for this date.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableSlots.map(slot => {
                          const label = formatInTimeZone(new Date(slot), slotsTimezone ?? SYSTEM_DEFAULT_TIMEZONE, 'h:mm a')
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSelectedSlot(slot)}
                              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                selectedSlot === slot
                                  ? 'bg-[#C27E00] text-white border border-[#C27E00]'
                                  : 'bg-black/50 text-gray-300 border border-gray-700 hover:bg-white/10'
                              }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={handleRevertToPending}
                disabled={loading || reverting}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded disabled:opacity-50 transition-colors text-sm"
              >
                {reverting ? 'Reverting...' : 'Revert to Pending'}
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    loading ||
                    reverting ||
                    !selectedSlot ||
                    (!!demand.dealer_id && availableSlots.length > 0 && !availableSlots.includes(selectedSlot))
                  }
                  className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] text-white rounded disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

