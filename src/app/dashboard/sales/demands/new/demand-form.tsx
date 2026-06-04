'use client'

import { useActionState, useState, useEffect } from 'react'
import { createDemand, getTakenSlots } from './actions'
import { getDealerBlocksForDate } from '@/app/dashboard/system-management/calendar/actions'
import { getGlobalSlotMinutes, getSlotMinutesFromConfig, CALENDAR_DEFAULTS } from '@/lib/calendar-defaults'
import { formatInTimeZone, toDate } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { pad2 } from '@/lib/calendar-wall-date'
import { useTimezone } from '@/contexts/timezone-context'
import { useSystemTime } from '@/contexts/system-time-context'
import { AppointmentCalendar } from '@/components/appointment-calendar'
import { VEHICLE_MAKES_CA } from '@/lib/vehicle-makes'
import { getModelsForMake, getTrimsForModel } from '@/lib/vehicle-models'
import { getISODay } from 'date-fns'
import { CanadianPhoneInput } from '@/components/canadian-phone-input'

interface CameraModel {
  id: string
  name: string
}

interface CalendarSetting {
  day_type: 'weekday' | 'saturday' | 'sunday'
  start_hour: number
  end_hour: number
  slot_interval_minutes: number
  appointment_duration_minutes: number
}

interface DemandFormProps {
  cameraModels: CameraModel[]
  defaultAddress?: string
  timezoneName?: string | null
  dealerId?: string | null
  calendarSettings?: { weekday?: CalendarSetting; saturday?: CalendarSetting; sunday?: CalendarSetting }
}

export function DemandForm({ cameraModels, defaultAddress = '', timezoneName: propTimezone = null, dealerId = null, calendarSettings }: DemandFormProps) {
  // Use layout timezone (same as top-left clock) when prop not provided
  const contextTimezone = useTimezone()
  const timezoneName = propTimezone ?? contextTimezone
  const [state, formAction, isPending] = useActionState(createDemand, null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [dealerBlocks, setDealerBlocks] = useState<{ start_minutes: number; end_minutes: number }[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [selectedCamera, setSelectedCamera] = useState<string>('')
  const [customCamera, setCustomCamera] = useState<string>('')
  const [selectedMake, setSelectedMake] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedTrim, setSelectedTrim] = useState<string>('')
  const [customModel, setCustomModel] = useState<string>('')

  useEffect(() => {
    if (selectedDate) {
      getTakenSlots(selectedDate + 'T00:00:00', dealerId ?? undefined, timezoneName ?? undefined).then(setTakenSlots)
    } else {
      setTakenSlots([])
    }
  }, [selectedDate, dealerId, timezoneName])

  useEffect(() => {
    if (dealerId && selectedDate) {
      getDealerBlocksForDate(dealerId, selectedDate).then(setDealerBlocks)
    } else {
      setDealerBlocks([])
    }
  }, [dealerId, selectedDate])

  // Clear selected date if it becomes past - uses same system time as clock/calendar
  const systemNow = useSystemTime()
  useEffect(() => {
    if (!selectedDate) return
    const todayStr = formatInTimeZone(systemNow, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
    if (selectedDate < todayStr) {
      setSelectedDate('')
      setSelectedSlot('')
    }
  }, [selectedDate, systemNow])

  useEffect(() => {
    if (!selectedDate) return
    const ptTz = SYSTEM_DEFAULT_TIMEZONE
    const isoDay = selectedDate
    const isoDow = getISODay(toDate(`${isoDay}T12:00:00`, { timeZone: ptTz }))
    const dayType = isoDow === 7 ? 'sunday' : isoDow === 6 ? 'saturday' : 'weekday'
    const setting = calendarSettings?.[dayType]
    const slotMinutes = setting
      ? getSlotMinutesFromConfig({
          startHour: setting.start_hour,
          endHour: setting.end_hour,
          slotIntervalMinutes: setting.slot_interval_minutes,
          appointmentDurationMinutes: setting.appointment_duration_minutes,
        })
      : getGlobalSlotMinutes()
    const nowMs = systemNow.getTime()
    const slots: string[] = []
    for (const startMinutes of slotMinutes) {
      const h = Math.floor(startMinutes / 60)
      const m = startMinutes % 60
      const wall = `${isoDay}T${pad2(h)}:${pad2(m)}:00`
      const utcMoment = toDate(wall, { timeZone: ptTz })
      // calendar_past_slots_lock: exclude slots that are already in the past (Pacific)
      if (utcMoment.getTime() > nowMs) {
        slots.push(utcMoment.toISOString())
      }
    }
    setAvailableSlots(slots)
  }, [selectedDate, calendarSettings, systemNow])

  return (
    <form action={formAction} className="space-y-6 max-w-4xl bg-zinc-200/50 dark:bg-white/5 p-6 sm:p-8 rounded-lg shadow border border-zinc-200 dark:border-gray-800 text-base">
      {state?.error && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 p-4 rounded-md text-base">
          {state.error}
          {state.fieldErrors && (
            <ul className="list-disc pl-5 mt-2 text-base">
                {Object.entries(state.fieldErrors).map(([key, errs]) => (
                    <li key={key}>{key}: {(errs as string[]).join(', ')}</li>
                ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
        <h3 className="col-span-full text-xl font-semibold leading-7 text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-gray-800 pb-2">Customer Information</h3>
        
        <div>
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">First Name</label>
          <input name="firstName" required style={{ textTransform: 'uppercase' }} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase() }} className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 text-base shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500" />
        </div>

        <div>
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">Last Name</label>
          <input name="lastName" required style={{ textTransform: 'uppercase' }} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase() }} className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500" />
        </div>

        <div>
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">
            Phone Number <span className="text-sm text-zinc-500 dark:text-gray-500">(416 - 123 - 4567)</span>
          </label>
          <CanadianPhoneInput
            name="phone"
            required
            placeholder="416 - 123 - 4567"
            className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500"
          />
        </div>

        <div>
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">Customer Address</label>
          <input 
            name="address" 
            value={defaultAddress}
            readOnly
            className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 text-base shadow-sm text-zinc-900 dark:text-white opacity-75 cursor-not-allowed" 
            placeholder="Address will be auto-filled with dealer name"
          />
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-gray-500">Address is automatically set to your dealer name and cannot be edited.</p>
        </div>

        <h3 className="col-span-full text-xl font-semibold leading-7 text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-gray-800 pb-2 mt-4">Vehicle Information</h3>

        <div>
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">Make</label>
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
            className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500"
          >
            <option value="">-- Select make --</option>
            {VEHICLE_MAKES_CA.map((make) => (
              <option key={make} value={make} className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
                {make}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">Model</label>
          {selectedMake ? (
            <div className="space-y-2">
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value)
                  setSelectedTrim('')
                  setCustomModel(e.target.value === '__custom__' ? customModel : '')
                }}
                required={selectedModel !== '__custom__'}
                className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500"
              >
                <option value="">-- Select model --</option>
                {getModelsForMake(selectedMake).map((model) => (
                  <option key={model} value={model} className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
                    {model}
                  </option>
                ))}
                <option value="__custom__" className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">Other</option>
              </select>
              {selectedModel && selectedModel !== '__custom__' && getTrimsForModel(selectedMake, selectedModel).length > 0 && (
                <select
                  value={selectedTrim}
                  onChange={(e) => setSelectedTrim(e.target.value)}
                  className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500"
                >
                  <option value="">-- Select trim (optional) --</option>
                  {getTrimsForModel(selectedMake, selectedModel).map((trim) => (
                    <option key={trim} value={trim} className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
                      {trim}
                    </option>
                  ))}
                </select>
              )}
              {selectedModel === '__custom__' && (
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="Enter model name"
                  required
                  name="vehicleModel"
                  className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500"
                />
              )}
              {(selectedModel && selectedModel !== '__custom__') && (
                <input
                  type="hidden"
                  name="vehicleModel"
                  value={selectedTrim ? `${selectedModel} (${selectedTrim})` : selectedModel}
                />
              )}
            </div>
          ) : (
            <input
              type="text"
              value=""
              readOnly
              placeholder="Select make first"
              className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 text-base shadow-sm text-zinc-500 dark:text-gray-500 cursor-not-allowed"
            />
          )}
        </div>

        <div>
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">Year</label>
          <input name="vehicleYear" type="number" min="1900" max="2100" required className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500" />
        </div>

        <div>
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">Stock Number</label>
          <input 
            name="stockNumber"
            style={{ textTransform: 'uppercase' }}
            onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase() }} 
            required 
            className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500" 
            placeholder="Enter stock number"
          />
        </div>

        <div>
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">VIN Last 6 Digits <span className="text-red-400">*</span></label>
          <input 
            name="vinLast6"
            style={{ textTransform: 'uppercase' }}
            onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase() }} 
            required
            minLength={6}
            className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500" 
            placeholder="Last 6 digits"
          />
        </div>

        <div>
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">
            Camera Model <span className="text-red-400">*</span>
          </label>
          {cameraModels.length > 0 ? (
            <div className="space-y-2">
              <select
                value={selectedCamera}
                onChange={(e) => {
                  setSelectedCamera(e.target.value)
                  setCustomCamera('')
                }}
                required
                className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500"
              >
                <option value="">-- Select a camera model --</option>
                {cameraModels.map((camera) => (
                  <option key={camera.id} value={camera.name} className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
                    {camera.name}
                  </option>
                ))}
                <option value="__custom__" className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">Other (Custom)</option>
              </select>
              {selectedCamera === '__custom__' && (
                <input
                  type="text"
                  value={customCamera}
                  onChange={(e) => setCustomCamera(e.target.value)}
                  placeholder="Enter custom camera model"
                  required={selectedCamera === '__custom__'}
                  className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500"
                />
              )}
              {!selectedCamera && (
                <p className="text-sm text-zinc-500 dark:text-gray-500">Please select a camera model</p>
              )}
              {selectedCamera && selectedCamera !== '__custom__' && (
                <input
                  type="hidden"
                  name="cameraModel"
                  value={selectedCamera}
                  required
                />
              )}
              {selectedCamera === '__custom__' && customCamera && (
                <input
                  type="hidden"
                  name="cameraModel"
                  value={customCamera}
                  required
                />
              )}
            </div>
          ) : (
            <div>
              <input
                name="cameraModel"
                required
                className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500"
                placeholder="Enter camera model"
              />
              <p className="text-sm text-zinc-500 dark:text-gray-500 mt-1.5">No camera models available. Enter manually.</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6">
        <h3 className="text-xl font-semibold leading-7 text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-gray-800 pb-2 mb-4">Appointment</h3>
        
        {/* Calendar View */}
        <div className="mb-6">
          <AppointmentCalendar
            timezoneName={SYSTEM_DEFAULT_TIMEZONE}
            onDateSelect={(date) => {
              const dateStr = formatInTimeZone(date, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
              setSelectedDate(dateStr)
              setSelectedSlot('')
            }}
            selectedPacificYmd={selectedDate}
            getTakenSlots={(dateStr) => getTakenSlots(dateStr, dealerId ?? undefined, timezoneName ?? undefined)}
          />
        </div>

        {selectedDate && (() => {
            const isoDow = getISODay(toDate(`${selectedDate}T12:00:00`, { timeZone: SYSTEM_DEFAULT_TIMEZONE }))
            const dayType = isoDow === 7 ? 'sunday' : isoDow === 6 ? 'saturday' : 'weekday'
            const setting = calendarSettings?.[dayType]
            const appointmentDurationMinutes = setting?.appointment_duration_minutes ?? CALENDAR_DEFAULTS.appointmentDurationMinutes
            // Filter out blocked slots: past slots (today), existing appointments + dealer calendar blocks (closed days/slots)
            // Same system time as clock/calendar
            const todayInPacific = formatInTimeZone(systemNow, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
            const nowMs = systemNow.getTime()

            const availableOnlySlots = availableSlots.filter(slot => {
                const slotTime = new Date(slot)
                const slotStart = slotTime.getTime()
                const slotEnd = slotStart + appointmentDurationMinutes * 60 * 1000

                // No retrospective appointments: exclude past slots for today (Pacific)
                if (selectedDate === todayInPacific && slotStart <= nowMs) return false

                const isTaken = takenSlots.some(takenSlot => {
                    const takenTime = new Date(takenSlot)
                    const takenStart = takenTime.getTime()
                    const takenEnd = takenStart + appointmentDurationMinutes * 60 * 1000
                    return slotStart < takenEnd && slotEnd > takenStart
                })
                if (isTaken) return false

                // Dealer calendar blocks: slot time in PT vs block [start_minutes, end_minutes] (blocks in PT)
                if (dealerBlocks.length > 0) {
                    const slotStartMinutes = parseInt(formatInTimeZone(slotTime, SYSTEM_DEFAULT_TIMEZONE, 'H'), 10) * 60 +
                      parseInt(formatInTimeZone(slotTime, SYSTEM_DEFAULT_TIMEZONE, 'm'), 10)
                    const slotEndMinutes = slotStartMinutes + appointmentDurationMinutes
                    const inBlock = dealerBlocks.some(
                      b => slotStartMinutes < b.end_minutes && slotEndMinutes > b.start_minutes
                    )
                    if (inBlock) return false
                }

                return true
            })
            
            return (
                <div className="space-y-2">
                    <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">Available Slots</label>
                    {availableOnlySlots.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {availableOnlySlots.map(slot => {
                                // Format slot time in dealer's timezone for display
                                const tz = timezoneName ?? SYSTEM_DEFAULT_TIMEZONE
                                const slotTime = formatInTimeZone(new Date(slot), tz, 'h:mm a')
                                
                                return (
                                    <button 
                                        type="button" 
                                        key={slot} 
                                        onClick={() => setSelectedSlot(slot)}
                                        className={`p-3 border rounded text-base font-medium min-h-[44px] transition-colors
                                            ${selectedSlot === slot 
                                                ? 'bg-[#C27E00] text-white border-[#C27E00]' 
                                                : 'bg-white dark:bg-black/50 hover:bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-gray-300 border-zinc-300 dark:border-gray-700'}`}
                                        title={slotTime}
                                    >
                                        {slotTime}
                                    </button>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-base text-zinc-500 dark:text-gray-500">No available slots for this date. All time slots are booked.</p>
                    )}
                </div>
            )
        })()}
        <input type="hidden" name="appointmentDate" value={selectedSlot} />

        <div className="mt-6">
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">Comment</label>
          <textarea
            name="comment"
            rows={3}
            placeholder="Optional note from the person creating this demand..."
            className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500"
          />
        </div>
      </div>

      <div className="pt-5">
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={
              isPending || 
              !selectedSlot || 
              (cameraModels.length > 0 && (!selectedCamera || (selectedCamera === '__custom__' && !customCamera)))
            }
            className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-[#C27E00] py-2.5 px-5 text-base font-semibold text-white shadow-sm hover:bg-[#a06900] focus:outline-none focus:ring-2 focus:ring-[#C27E00] focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Submitting...' : 'Create Demand'}
          </button>
        </div>
      </div>
    </form>
  )
}

