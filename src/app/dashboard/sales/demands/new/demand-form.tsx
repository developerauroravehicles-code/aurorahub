'use client'

import { useActionState, useState, useEffect } from 'react'
import { createDemand, getTakenSlots } from './actions'
import { format, addMinutes, setHours, setMinutes, isSunday, isSaturday } from 'date-fns'
import { AppointmentCalendar } from '@/components/appointment-calendar'

interface CameraModel {
  id: string
  name: string
}

export function DemandForm({ cameraModels, defaultAddress = '', timezoneName = null }: { cameraModels: CameraModel[]; defaultAddress?: string; timezoneName?: string | null }) {
  const [state, formAction, isPending] = useActionState(createDemand, null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [selectedCamera, setSelectedCamera] = useState<string>('')
  const [customCamera, setCustomCamera] = useState<string>('')

  useEffect(() => {
    if (selectedDate) {
      // Pass the date string directly
      getTakenSlots(selectedDate + 'T00:00:00').then(setTakenSlots)
    } else {
      setTakenSlots([])
    }
  }, [selectedDate])

  useEffect(() => {
    if (!selectedDate) return
    
    // Create date in local time
    const date = new Date(selectedDate + 'T00:00:00')
    const slots = []
    
    // Appointment rules:
    // - Each appointment is 1 hour 15 minutes (75 minutes)
    // - Slots are created with 1.5 hours (90 minutes) gap between start times
    // - Monday - Saturday: 09:00-18:00 (last slot must end by 18:00)
    // - Sunday: 11:00-17:00 (last slot must end by 17:00)
    
    let startHour = 9 // Start at 09:00 AM
    let endHour = 18 // Working hours end time
    const appointmentDuration = 75 // 1 hour 15 minutes in minutes
    const slotInterval = 90 // 1.5 hours (90 minutes) gap between slot start times
    
    if (isSunday(date)) {
        startHour = 11
        endHour = 17
    }

    // Generate slots with 90-minute intervals
    // Start from 09:00 AM (or 11:00 AM on Sunday)
    let current = setMinutes(setHours(date, startHour), 0)
    
    // Calculate the latest possible start time (so the appointment ends by endHour)
    // If endHour is 18:00 and appointment is 1h 15m, last start time is 16:45 (18:00 - 1h 15m = 16:45)
    const latestStartTime = setMinutes(setHours(date, endHour), 0)
    const latestAllowedStart = addMinutes(latestStartTime, -appointmentDuration)

    while (current <= latestAllowedStart) {
        slots.push(current.toISOString())
        current = addMinutes(current, slotInterval) // 90 minutes intervals (1.5 hours)
    }
    
    setAvailableSlots(slots)
  }, [selectedDate])

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
            Phone Number <span className="text-xs text-gray-500">(e.g., 0555 123 45 67 or +90 555 123 45 67)</span>
          </label>
          <input 
            name="phone" 
            type="tel" 
            required 
            placeholder="0555 123 45 67"
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
          <input name="vehicleMake" required className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Model</label>
          <input name="vehicleModel" required className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white" />
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
            timezoneName={timezoneName}
            onDateSelect={(date) => {
              const dateStr = format(date, 'yyyy-MM-dd')
              setSelectedDate(dateStr)
              setSelectedSlot('')
            }}
            selectedDate={selectedDate ? new Date(selectedDate + 'T00:00:00') : null}
            getTakenSlots={getTakenSlots}
          />
        </div>

        {/* Date Input (Alternative) */}
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">Or Select Date Manually</label>
            <input 
                type="date" 
                value={selectedDate}
                required 
                onChange={e => {
                    const selected = e.target.value
                    const today = new Date().toISOString().split('T')[0]
                    // Prevent selecting past dates
                    if (selected >= today) {
                      setSelectedDate(selected)
                      setSelectedSlot('')
                    }
                }}
                min={new Date().toISOString().split('T')[0]}
                className="block w-full max-w-xs rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white [color-scheme:dark]"
            />
        </div>

        {selectedDate && (() => {
            // Filter out blocked slots - only show available slots
            // A slot is blocked if it overlaps with an existing appointment OR violates the 90-minute gap rule
            const availableOnlySlots = availableSlots.filter(slot => {
                const slotTime = new Date(slot)
                const slotStart = slotTime.getTime()
                const slotEnd = slotStart + 75 * 60 * 1000 // 75 minutes (appointment duration)
                
                // Check if this slot overlaps with any taken appointment or violates gap rule
                const isBlocked = takenSlots.some(takenSlot => {
                    const takenTime = new Date(takenSlot)
                    const takenStart = takenTime.getTime()
                    const takenEnd = takenStart + 75 * 60 * 1000 // 75 minutes (appointment duration)
                    
                    // Check for overlap: slotStart < takenEnd && slotEnd > takenStart
                    const overlaps = slotStart < takenEnd && slotEnd > takenStart
                    
                    // Check for gap violation: slots must be at least 90 minutes apart
                    // If slot is within 90 minutes before or after an existing appointment, it's blocked
                    const gapBefore = takenStart - slotEnd // Gap between slot end and taken start
                    const gapAfter = slotStart - takenEnd // Gap between taken end and slot start
                    const violatesGap = (gapBefore >= 0 && gapBefore < 90 * 60 * 1000) || (gapAfter >= 0 && gapAfter < 90 * 60 * 1000)
                    
                    return overlaps || violatesGap
                })
                
                return !isBlocked // Only include non-blocked slots
            })
            
            return (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Available Slots</label>
                    {availableOnlySlots.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {availableOnlySlots.map(slot => (
                                <button 
                                    type="button" 
                                    key={slot} 
                                    onClick={() => setSelectedSlot(slot)}
                                    className={`p-2 border rounded text-sm font-medium transition-colors
                                        ${selectedSlot === slot 
                                            ? 'bg-[#C27E00] text-white border-[#C27E00]' 
                                            : 'bg-black/50 hover:bg-white/10 text-gray-300 border-gray-700'}`}
                                    title={format(new Date(slot), 'HH:mm')}
                                >
                                    {format(new Date(slot), 'HH:mm')}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No available slots for this date. All time slots are booked.</p>
                    )}
                </div>
            )
        })()}
        <input type="hidden" name="appointmentDate" value={selectedSlot} />
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

