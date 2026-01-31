'use client'

import { useActionState, useState, useEffect } from 'react'
import { createDemand, getTakenSlots } from './actions'
import { format, addMinutes, setHours, setMinutes, isSunday, isSaturday } from 'date-fns'

interface CameraModel {
  id: string
  name: string
}

export function DemandForm({ cameraModels }: { cameraModels: CameraModel[] }) {
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
    }
  }, [selectedDate])

  useEffect(() => {
    if (!selectedDate) return
    
    // Create date in local time
    const date = new Date(selectedDate + 'T00:00:00')
    const slots = []
    
    // Appointment rules:
    // - Each appointment is 1 hour 15 minutes (75 minutes)
    // - Monday - Saturday: 09:00-18:00 (last slot must end by 18:00)
    // - Sunday: 11:00-17:00 (last slot must end by 17:00)
    
    let startHour = 9
    let endHour = 18 // Working hours end time
    const slotDuration = 75 // 1 hour 15 minutes in minutes
    
    if (isSunday(date)) {
        startHour = 11
        endHour = 17
    }

    // Generate slots
    // Start from the beginning hour
    let current = setMinutes(setHours(date, startHour), 0)
    
    // Calculate the latest possible start time (so the appointment ends by endHour)
    // If endHour is 18:00 and slot is 1h 15m, last start time is 16:45 (18:00 - 1h 15m = 16:45)
    const latestStartTime = setMinutes(setHours(date, endHour), 0)
    const latestAllowedStart = addMinutes(latestStartTime, -slotDuration)

    while (current <= latestAllowedStart) {
        slots.push(current.toISOString())
        current = addMinutes(current, slotDuration) // 1h 15m intervals
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
          <label className="block text-sm font-medium text-gray-300">Address</label>
          <input name="address" className="mt-1 block w-full rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white" />
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
        
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">Select Date</label>
            <input 
                type="date" 
                required 
                onChange={e => {
                    setSelectedDate(e.target.value)
                    setSelectedSlot('')
                }}
                min={new Date().toISOString().split('T')[0]}
                className="block w-full max-w-xs rounded-md border border-gray-700 bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-white [color-scheme:dark]"
            />
        </div>

        {selectedDate && (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">Available Slots</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {availableSlots.map(slot => {
                        const isTaken = takenSlots.includes(slot)
                        return (
                            <button 
                                type="button" 
                                key={slot} 
                                disabled={isTaken}
                                onClick={() => setSelectedSlot(slot)}
                                className={`p-2 border rounded text-sm font-medium transition-colors
                                    ${selectedSlot === slot ? 'bg-[#C27E00] text-white border-[#C27E00]' : 
                                      isTaken ? 'bg-white/5 text-gray-500 cursor-not-allowed border-gray-800' : 'bg-black/50 hover:bg-white/10 text-gray-300 border-gray-700'}`}
                            >
                                {format(new Date(slot), 'HH:mm')}
                            </button>
                        )
                    })}
                </div>
                {availableSlots.length === 0 && <p className="text-sm text-gray-500">No slots available for this date.</p>}
            </div>
        )}
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

