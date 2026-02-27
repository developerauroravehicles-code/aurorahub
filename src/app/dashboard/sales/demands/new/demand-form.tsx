'use client'

import { useActionState, useState, useEffect } from 'react'
import { createDemand, getTakenSlots } from './actions'
import { getDealerBlocksForDate } from '@/app/dashboard/system-management/calendar/actions'
import { getGlobalSlotMinutes, getSlotMinutesFromConfig, CALENDAR_DEFAULTS } from '@/lib/calendar-defaults'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { useTimezone } from '@/contexts/timezone-context'
import { useSystemTime } from '@/contexts/system-time-context'
import { AppointmentCalendar } from '@/components/appointment-calendar'
import { VEHICLE_MAKES_CA } from '@/lib/vehicle-makes'
import { getModelsForMake, getTrimsForModel } from '@/lib/vehicle-models'

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
    const dateStr = selectedDate
    const [y, mo, d] = dateStr.split('-').map(Number)
    const dayOfWeek = new Date(y, mo - 1, d).getDay()
    const dayType = dayOfWeek === 6 ? 'saturday' : dayOfWeek === 0 ? 'sunday' : 'weekday'
    const setting = calendarSettings?.[dayType]
    const slotMinutes = setting
      ? getSlotMinutesFromConfig({
          startHour: setting.start_hour,
          endHour: setting.end_hour,
          slotIntervalMinutes: setting.slot_interval_minutes,
          appointmentDurationMinutes: setting.appointment_duration_minutes,
        })
      : getGlobalSlotMinutes()
    const slots: string[] = []
    for (const startMinutes of slotMinutes) {
      const h = Math.floor(startMinutes / 60)
      const m = startMinutes % 60
      // Appointments stored as Pacific Time (PT) - system default
      const dateInPT = new Date(y, mo - 1, d, h, m, 0)
      const utcMoment = fromZonedTime(dateInPT, SYSTEM_DEFAULT_TIMEZONE)
      slots.push(utcMoment.toISOString())
    }
    setAvailableSlots(slots)
  }, [selectedDate, timezoneName, calendarSettings])

  return (
    <form action={formAction} className="space-y-6 max-w-4xl bg-white/5 p-8 rounded-lg shadow border border-gray-800">
      {state?.error && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 p-4 rounded-md">
          {state.error}
          {state.fieldErrors && (
            <ul className="list-disc pl-5 mt-2 text-sm">
                {Object.entries(state.fieldErrors).map(([key, errs]) => (
                    <li key={key}>{key}: {(errs as string[]).join(', ')}</li>
                ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
        <h3 className="col-span-full text-lg font-medium leading-6 text-white border-b border-gray-800 pb-2">Customer Information</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-300">First Name</label>
          <input name="firstName" required className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Last Name</label>
          <input name="lastName" required className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">
            Phone Number <span className="text-xs text-gray-500">(e.g., (604) 833-5801 or +1 604 833 5801)</span>
          </label>
          <input 
            name="phone" 
            type="tel" 
            required 
            placeholder="(604) 833-5801"
            className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white" 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Customer Address</label>
          <input 
            name="address" 
            value={defaultAddress}
            readOnly
            className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm sm:text-sm text-white opacity-75 cursor-not-allowed" 
            placeholder="Address will be auto-filled with dealer name"
          />
          <p className="mt-1 text-xs text-gray-500">Address is automatically set to your dealer name and cannot be edited.</p>
        </div>

        <h3 className="col-span-full text-lg font-medium leading-6 text-white border-b border-gray-800 pb-2 mt-4">Vehicle Information</h3>

        <div>
          <label className="block text-sm font-medium text-gray-300">Make</label>
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
            className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white"
          >
            <option value="">-- Select make --</option>
            {VEHICLE_MAKES_CA.map((make) => (
              <option key={make} value={make} className="bg-black text-white">
                {make}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Model</label>
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
                className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white"
              >
                <option value="">-- Select model --</option>
                {getModelsForMake(selectedMake).map((model) => (
                  <option key={model} value={model} className="bg-black text-white">
                    {model}
                  </option>
                ))}
                <option value="__custom__" className="bg-black text-white">Other</option>
              </select>
              {selectedModel && selectedModel !== '__custom__' && getTrimsForModel(selectedMake, selectedModel).length > 0 && (
                <select
                  value={selectedTrim}
                  onChange={(e) => setSelectedTrim(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white"
                >
                  <option value="">-- Select trim (optional) --</option>
                  {getTrimsForModel(selectedMake, selectedModel).map((trim) => (
                    <option key={trim} value={trim} className="bg-black text-white">
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
                  className="block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white"
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
              className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm sm:text-sm text-gray-500 cursor-not-allowed"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Year</label>
          <input name="vehicleYear" type="number" min="1900" max="2100" required className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Stock Number</label>
          <input 
            name="stockNumber" 
            required 
            className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white" 
            placeholder="Enter stock number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">
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
                className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white"
              >
                <option value="">-- Select a camera model --</option>
                {cameraModels.map((camera) => (
                  <option key={camera.id} value={camera.name} className="bg-black text-white">
                    {camera.name}
                  </option>
                ))}
                <option value="__custom__" className="bg-black text-white">Other (Custom)</option>
              </select>
              {selectedCamera === '__custom__' && (
                <input
                  type="text"
                  value={customCamera}
                  onChange={(e) => setCustomCamera(e.target.value)}
                  placeholder="Enter custom camera model"
                  required={selectedCamera === '__custom__'}
                  className="block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white"
                />
              )}
              {!selectedCamera && (
                <p className="text-xs text-gray-500">Please select a camera model</p>
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
                className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white"
                placeholder="Enter camera model"
              />
              <p className="text-xs text-gray-500 mt-1">No camera models available. Enter manually.</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6">
        <h3 className="text-lg font-medium leading-6 text-white border-b border-gray-800 pb-2 mb-4">Appointment</h3>
        
        {/* Calendar View */}
        <div className="mb-6">
          <AppointmentCalendar
            timezoneName={SYSTEM_DEFAULT_TIMEZONE}
            onDateSelect={(date) => {
              const dateStr = formatInTimeZone(date, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
              setSelectedDate(dateStr)
              setSelectedSlot('')
            }}
            selectedDate={selectedDate ? new Date(selectedDate + 'T00:00:00') : null}
            getTakenSlots={(dateStr) => getTakenSlots(dateStr, dealerId ?? undefined, timezoneName ?? undefined)}
          />
        </div>

        {selectedDate && (() => {
            const [y, mo, d] = selectedDate.split('-').map(Number)
            const dayOfWeek = new Date(y, mo - 1, d).getDay()
            const dayType = dayOfWeek === 6 ? 'saturday' : dayOfWeek === 0 ? 'sunday' : 'weekday'
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
                    <label className="block text-sm font-medium text-gray-300">Available Slots</label>
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
                                        className={`p-2 border rounded text-sm font-medium transition-colors
                                            ${selectedSlot === slot 
                                                ? 'bg-[#C27E00] text-white border-[#C27E00]' 
                                                : 'bg-black/50 hover:bg-white/10 text-gray-300 border-gray-700'}`}
                                        title={slotTime}
                                    >
                                        {slotTime}
                                    </button>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No available slots for this date. All time slots are booked.</p>
                    )}
                </div>
            )
        })()}
        <input type="hidden" name="appointmentDate" value={selectedSlot} />

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-300">Comment</label>
          <textarea
            name="comment"
            rows={3}
            placeholder="Optional note from the person creating this demand..."
            className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white"
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
            className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-[#C27E00] py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-[#a06900] focus:outline-none focus:ring-2 focus:ring-[#C27E00] focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Submitting...' : 'Create Demand'}
          </button>
        </div>
      </div>
    </form>
  )
}

