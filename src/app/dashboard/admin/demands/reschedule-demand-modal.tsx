'use client'

import { useState, useEffect } from 'react'
import { updateDemandByAuroraManager } from './actions'
import { getAvailableSlotsForEdit } from '@/app/dashboard/system-management/calendar/actions'
import { useRouter } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { AppointmentCalendar } from '@/components/appointment-calendar'
import { SYSTEM_DEFAULT_TIMEZONE, getEffectiveTimezone } from '@/lib/timezone-defaults'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { appointmentIsoToWallDate } from '@/lib/external-demand-date'
import { VEHICLE_MAKES_CA } from '@/lib/vehicle-makes'
import { getModelsForMake, getTrimsForModel } from '@/lib/vehicle-models'
import { CanadianPhoneInput, formatCanadianPhone } from '@/components/canadian-phone-input'

function parseModelAndTrim(val: string): { model: string; trim: string } {
  const m = val?.match(/^(.+?)\s*\(([^)]+)\)$/)
  return m ? { model: m[1].trim(), trim: m[2].trim() } : { model: val || '', trim: '' }
}

interface Demand {
  id: string
  demand_number?: number | string
  dealer_id?: string | null
  is_external?: boolean | null
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
  dealers?: { region_codes?: { timezone_id?: string; timezones?: { name: string } } } | null
}

interface RescheduleDemandModalProps {
  demand: Demand
  isOpen: boolean
  onClose: () => void
}

export function RescheduleDemandModal({ demand, isOpen, onClose }: RescheduleDemandModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSmsConfirm, setShowSmsConfirm] = useState(false)
  const [sendToCustomer, setSendToCustomer] = useState(true)
  const [sendToSpecialist, setSendToSpecialist] = useState(true)
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)

  const [formData, setFormData] = useState({
    customer_firstname: demand.customer_firstname,
    customer_lastname: demand.customer_lastname,
    customer_phone: formatCanadianPhone(demand.customer_phone ?? ''),
    customer_address: demand.customer_address || '',
    vehicle_make: demand.vehicle_make,
    vehicle_model: demand.vehicle_model,
    vehicle_year: demand.vehicle_year,
    stock_number: demand.stock_number || '',
    camera_model: demand.camera_model,
  })
  const dealerTz = getEffectiveTimezone(getTimezoneFromDealer(demand.dealers ?? null))
  const isExternal = !!demand.is_external
  const [selectedDate, setSelectedDate] = useState(() =>
    isExternal
      ? appointmentIsoToWallDate(demand.appointment_date, dealerTz)
      : formatInTimeZone(new Date(demand.appointment_date), dealerTz, 'yyyy-MM-dd')
  )
  const [selectedSlot, setSelectedSlot] = useState<string>(() => demand.appointment_date)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [slotsTimezone, setSlotsTimezone] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFormData({
        customer_firstname: demand.customer_firstname,
        customer_lastname: demand.customer_lastname,
        customer_phone: formatCanadianPhone(demand.customer_phone ?? ''),
        customer_address: demand.customer_address || '',
        vehicle_make: demand.vehicle_make,
        vehicle_model: demand.vehicle_model,
        vehicle_year: demand.vehicle_year,
        stock_number: demand.stock_number || '',
        camera_model: demand.camera_model,
      })
      const tz = getEffectiveTimezone(getTimezoneFromDealer(demand.dealers ?? null))
      setSelectedDate(
        isExternal
          ? appointmentIsoToWallDate(demand.appointment_date, tz)
          : formatInTimeZone(new Date(demand.appointment_date), tz, 'yyyy-MM-dd')
      )
      setSelectedSlot(demand.appointment_date)
      setError(null)
      setShowSmsConfirm(false)
      setPendingFormData(null)
    }
  }, [isOpen, demand, isExternal])

  useEffect(() => {
    if (!isOpen || !demand.dealer_id || isExternal) {
      if (!demand.dealer_id || isExternal) setAvailableSlots([])
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
  }, [isOpen, demand.dealer_id, demand.id, selectedDate, isExternal])

  const buildFormData = (): FormData => {
    const form = new FormData()
    Object.entries(formData).forEach(([key, value]) => form.append(key, value.toString()))
    if (isExternal) {
      form.append('appointment_date_date', selectedDate)
    } else {
      form.append('appointment_date', selectedSlot)
    }
    return form
  }

  const appointmentChanged = () => {
    if (isExternal) {
      const oldCal = appointmentIsoToWallDate(demand.appointment_date, dealerTz)
      return oldCal !== selectedDate
    }
    const oldStr = formatInTimeZone(new Date(demand.appointment_date), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd HH:mm')
    const newStr = formatInTimeZone(new Date(selectedSlot), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd HH:mm')
    return oldStr !== newStr
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)
    const form = buildFormData()

    if (appointmentChanged()) {
      setPendingFormData(form)
      setShowSmsConfirm(true)
      return
    }
    await doSubmit(form, false, false)
  }

  const doSubmit = async (form: FormData, toCustomer: boolean, toSpecialist: boolean) => {
    setLoading(true)
    const result = await updateDemandByAuroraManager(demand.id, form, {
      sendToCustomer: toCustomer,
      sendToSpecialist: toSpecialist,
    })
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setShowSmsConfirm(false)
      setPendingFormData(null)
      router.refresh()
      onClose()
    }
  }

  const handleSmsConfirm = async () => {
    if (!pendingFormData) return
    await doSubmit(pendingFormData, sendToCustomer, sendToSpecialist)
  }

  const handleSmsCancel = () => {
    setShowSmsConfirm(false)
    setPendingFormData(null)
  }

  if (!isOpen) return null

  const inputClass =
    'w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2 px-3 rounded text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]'
  const today = formatInTimeZone(new Date(), isExternal ? dealerTz : SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')

  return (
    <>
      <div className="fixed inset-0 bg-white dark:bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-200 dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Reschedule / Edit Demand</h2>
                {demand.demand_number != null && (
                  <p className="text-sm text-zinc-500 dark:text-gray-500 mt-1">Demand ID: <span className="font-medium text-[#C27E00]">#{demand.demand_number}</span></p>
                )}
              </div>
              <button onClick={onClose} className="text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-800 text-red-200 p-4 rounded-md mb-4">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">First Name *</label>
                  <input type="text" value={formData.customer_firstname} onChange={(e) => setFormData({ ...formData, customer_firstname: e.target.value.toUpperCase() })} style={{ textTransform: 'uppercase' }} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Last Name *</label>
                  <input type="text" value={formData.customer_lastname} onChange={(e) => setFormData({ ...formData, customer_lastname: e.target.value.toUpperCase() })} style={{ textTransform: 'uppercase' }} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Phone *</label>
                  <CanadianPhoneInput
                    value={formData.customer_phone}
                    onChange={(v) => setFormData({ ...formData, customer_phone: v })}
                    required
                    placeholder="416 - 123 - 4567"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Address</label>
                  <input type="text" value={formData.customer_address} onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Vehicle Make *</label>
                  <select value={formData.vehicle_make} onChange={(e) => setFormData({ ...formData, vehicle_make: e.target.value, vehicle_model: '' })} required className={inputClass}>
                    <option value="">-- Select --</option>
                    {VEHICLE_MAKES_CA.map((m) => (
                      <option key={m} value={m} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Vehicle Model *</label>
                  <input type="text" value={formData.vehicle_model} onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Vehicle Year *</label>
                  <input type="number" min={1900} max={2100} value={formData.vehicle_year} onChange={(e) => setFormData({ ...formData, vehicle_year: parseInt(e.target.value) || 0 })} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Stock Number</label>
                  <input type="text" value={formData.stock_number} onChange={(e) => setFormData({ ...formData, stock_number: e.target.value.toUpperCase() })} className={inputClass} style={{ textTransform: 'uppercase' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Camera Model *</label>
                  <input type="text" value={formData.camera_model} onChange={(e) => setFormData({ ...formData, camera_model: e.target.value })} required className={inputClass} />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Appointment *</label>
                  {isExternal ? (
                    <AppointmentCalendar
                      timezoneName={dealerTz}
                      allowPastDates
                      selectedPacificYmd={selectedDate || null}
                      onDateSelect={(date) => {
                        setSelectedDate(formatInTimeZone(date, dealerTz, 'yyyy-MM-dd'))
                      }}
                      getTakenSlots={async () => []}
                    />
                  ) : !demand.dealer_id ? (
                    <p className="text-sm text-amber-500">Dealer not set; cannot show slots.</p>
                  ) : (
                    <div className="space-y-3">
                      <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={today} className={`${inputClass} max-w-xs dark:[color-scheme:dark]`} />
                      {slotsLoading ? <p className="text-sm text-zinc-500 dark:text-gray-500">Loading slots…</p> : availableSlots.length === 0 ? <p className="text-sm text-amber-500">No available slots.</p> : (
                        <div className="flex flex-wrap gap-2">
                          {availableSlots.map((slot) => (
                            <button key={slot} type="button" onClick={() => setSelectedSlot(slot)}
                              className={`px-3 py-2 rounded text-sm ${selectedSlot === slot ? 'bg-[#C27E00] text-white' : 'bg-white dark:bg-black/50 text-zinc-600 dark:text-gray-300 border border-zinc-300 dark:border-gray-700 hover:bg-zinc-200 dark:bg-white/10'}`}>
                              {formatInTimeZone(new Date(slot), slotsTimezone ?? SYSTEM_DEFAULT_TIMEZONE, 'h:mm a')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-gray-800">
                <button type="button" onClick={onClose} className="px-4 py-2 text-zinc-600 dark:text-gray-300 hover:text-zinc-900 dark:text-white">Cancel</button>
                <button type="submit" disabled={loading || (!isExternal && !!demand.dealer_id && availableSlots.length > 0 && !availableSlots.includes(selectedSlot))}
                  className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] text-white rounded disabled:opacity-50">
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* SMS confirmation pop-up */}
      {showSmsConfirm && (
        <div className="fixed inset-0 bg-zinc-50 dark:bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Send notification?</h3>
            <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">The appointment has been rescheduled. Would you like to send an SMS notification to:</p>
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sendToCustomer} onChange={(e) => setSendToCustomer(e.target.checked)} className="rounded text-[#C27E00]" />
                <span className="text-zinc-900 dark:text-white">Customer</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sendToSpecialist} onChange={(e) => setSendToSpecialist(e.target.checked)} className="rounded text-[#C27E00]" />
                <span className="text-zinc-900 dark:text-white">Specialist</span>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={handleSmsCancel} className="px-4 py-2 text-zinc-600 dark:text-gray-300 hover:text-zinc-900 dark:text-white">Cancel</button>
              <button type="button" onClick={handleSmsConfirm} disabled={loading} className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] text-white rounded disabled:opacity-50">
                {loading ? 'Saving...' : 'Update & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
