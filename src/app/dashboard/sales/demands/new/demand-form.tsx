'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Printer } from 'lucide-react'
import { createDemand, type CreateDemandState } from './actions'
import { getDealerBlocksForDate, getPoolSlotContext } from '@/app/dashboard/system-management/calendar/actions'
import {
  CALENDAR_DEFAULTS,
  dealerCalendarRowToSlotConfig,
  getGlobalSlotMinutes,
  getSlotMinutesFromConfig,
} from '@/lib/calendar-defaults'
import { countOverlapsAtSlot } from '@/lib/scheduling-pool'
import { formatInTimeZone, toDate } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { pad2 } from '@/lib/calendar-wall-date'
import { useTimezone } from '@/contexts/timezone-context'
import { useSystemTime } from '@/contexts/system-time-context'
import { AppointmentCalendar } from '@/components/appointment-calendar'
import { getISODay } from 'date-fns'
import {
  isIsoDowClosed,
  resolveCalendarSettingForIsoDow,
  type DealerCalendarSettingsMap,
} from '@/lib/dealer-calendar-day-type'
import { CanadianPhoneInput } from '@/components/canadian-phone-input'
import { VinDecodeField } from '@/components/vin-decode-field'
import { VinManualVehicleFields } from '@/components/vin-manual-vehicle-fields'
import type { DemandVehicleFieldsFromVin } from '@/lib/vin-decode/map-to-demand-vehicle'
import {
  DemandCustomerHandoffPrint,
  printDemandHandoffSheet,
} from '@/components/demand-customer-handoff-print'

interface CameraModel {
  id: string
  name: string
  label?: string
}

interface DemandFormProps {
  cameraModels: CameraModel[]
  defaultAddress?: string
  timezoneName?: string | null
  dealerId?: string | null
  calendarSettings?: DealerCalendarSettingsMap
  weeklyClosedIsoDays?: number[]
}

function isDemandErrorState(
  state: CreateDemandState
): state is { error?: string; fieldErrors?: Record<string, string[]> } {
  return state != null && !('success' in state && state.success)
}

export function DemandForm({
  cameraModels,
  defaultAddress = '',
  timezoneName: propTimezone = null,
  dealerId = null,
  calendarSettings,
  weeklyClosedIsoDays = [],
}: DemandFormProps) {
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [printSheetReady, setPrintSheetReady] = useState(false)
  // Use layout timezone (same as top-left clock) when prop not provided
  const contextTimezone = useTimezone()
  const timezoneName = propTimezone ?? contextTimezone
  const [state, formAction, isPending] = useActionState(createDemand, null as CreateDemandState)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [poolCapacity, setPoolCapacity] = useState(1)
  const [dealerBlocks, setDealerBlocks] = useState<{ start_minutes: number; end_minutes: number }[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [selectedCamera, setSelectedCamera] = useState<string>('')
  const [customCamera, setCustomCamera] = useState<string>('')
  const [phone, setPhone] = useState('')
  const [vinDecodeWarning, setVinDecodeWarning] = useState(false)
  const [vinDecodePending, setVinDecodePending] = useState(false)
  const [vehicleYear, setVehicleYear] = useState('')
  const [stockNumber, setStockNumber] = useState('')
  const [vinLast6, setVinLast6] = useState('')
  const [selectedMake, setSelectedMake] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedTrim, setSelectedTrim] = useState<string>('')
  const [customModel, setCustomModel] = useState<string>('')

  useEffect(() => {
    if (selectedDate && dealerId) {
      getPoolSlotContext(dealerId, selectedDate).then(({ appointments, capacity }) => {
        setTakenSlots(appointments)
        setPoolCapacity(capacity)
      })
    } else {
      setTakenSlots([])
      setPoolCapacity(1)
    }
  }, [selectedDate, dealerId])

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
    if (isIsoDowClosed(weeklyClosedIsoDays, isoDow)) {
      setAvailableSlots([])
      return
    }
    const setting = resolveCalendarSettingForIsoDow(calendarSettings, isoDow)
    const slotMinutes = setting
      ? getSlotMinutesFromConfig(dealerCalendarRowToSlotConfig(setting))
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
  }, [selectedDate, calendarSettings, weeklyClosedIsoDays, systemNow])

  function applyVinDecodeFields(fields: DemandVehicleFieldsFromVin, _hint?: string, markWarning?: boolean) {
    setVinDecodeWarning(!!markWarning)
    setVinLast6(fields.vinLast6)
    if (fields.vehicleYear) setVehicleYear(fields.vehicleYear)
    if (fields.selectedMake) {
      setSelectedMake(fields.selectedMake)
      setSelectedTrim(fields.selectedTrim)
      if (fields.selectedModel === '__custom__') {
        setSelectedModel('__custom__')
        setCustomModel(fields.customModel)
      } else if (fields.selectedModel) {
        setSelectedModel(fields.selectedModel)
        setCustomModel('')
      }
    } else if (fields.rawMake) {
      setSelectedMake(fields.rawMake)
    }
  }

  function onVinDecodeFailed(payload: { vinLast6: string }) {
    setVinDecodeWarning(true)
    setVinLast6(payload.vinLast6)
    setVehicleYear('')
    setSelectedMake('')
    setSelectedModel('')
    setSelectedTrim('')
    setCustomModel('')
  }

  const vehicleModelForSubmit =
    selectedModel === '__custom__'
      ? customModel
      : selectedModel
        ? selectedTrim
          ? `${selectedModel} (${selectedTrim})`
          : selectedModel
        : customModel

  const vehicleReady =
    vinLast6.length >= 6 &&
    !!vehicleYear.trim() &&
    !!selectedMake.trim() &&
    !!(vehicleModelForSubmit?.trim() || customModel.trim())

  if (state && 'success' in state && state.success) {
    const { demand, dealer, timezoneName: successTz, role } = state
    const listHref =
      role === 'finance' ? '/dashboard/finance/demands' : '/dashboard/sales/demands'

    return (
      <div className="max-w-4xl space-y-6">
        <div className="rounded-lg border border-green-800/40 bg-green-950/20 p-6 sm:p-8 shadow">
          <div className="flex items-start gap-4">
            <CheckCircle className="h-10 w-10 text-green-400 shrink-0" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Demand created</h2>
              <p className="text-zinc-600 dark:text-gray-400">
                Demand #{demand.demand_number} is booked. The customer received a link by SMS to confirm
                their name and phone. You can print the sheet below for the desk.
              </p>
              {state.smsSent ? (
                <p className="text-sm text-green-700 dark:text-green-300">Customer link sent by SMS.</p>
              ) : state.smsError ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  SMS failed: {state.smsError}. Share this link:{' '}
                  <span className="font-mono text-xs break-all">{state.portalUrl}</span>
                </p>
              ) : state.portalUrl ? (
                <p className="text-sm text-zinc-600 dark:text-gray-400 font-mono text-xs break-all">
                  Customer link: {state.portalUrl}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void printDemandHandoffSheet(printRef.current)}
              disabled={!printSheetReady}
              className="inline-flex items-center gap-2 rounded-md bg-[#C27E00] px-5 py-2.5 text-base font-semibold text-white hover:bg-[#a06900] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="h-4 w-4" />
              {printSheetReady ? 'Print Customer Sheet' : 'Preparing print sheet…'}
            </button>
            <button
              type="button"
              onClick={() => router.push(listHref)}
              className="inline-flex items-center rounded-md border border-zinc-300 dark:border-gray-700 px-5 py-2.5 text-base font-medium text-zinc-700 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
            >
              Back to Demands
            </button>
          </div>
        </div>

        <DemandCustomerHandoffPrint
          ref={printRef}
          demand={demand}
          dealer={dealer}
          timezoneName={successTz ?? timezoneName}
          onPrintReadyChange={setPrintSheetReady}
        />
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-6 max-w-4xl bg-zinc-200/50 dark:bg-white/5 p-6 sm:p-8 rounded-lg shadow border border-zinc-200 dark:border-gray-800 text-base">
      {isDemandErrorState(state) && state.error && (
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

      <p className="text-sm text-zinc-600 dark:text-gray-400">
        Enter the full <strong>VIN</strong> (auto-decodes) and the customer <strong>phone</strong> (stock optional).
        Name and address are completed by the customer via the SMS link.
      </p>

      <input type="hidden" name="address" value={defaultAddress} />
      <input type="hidden" name="vehicleMake" value={selectedMake} />
      <input type="hidden" name="vehicleModel" value={vehicleModelForSubmit} />
      <input type="hidden" name="vehicleYear" value={vehicleYear} />
      <input type="hidden" name="vinLast6" value={vinLast6} />
      <input type="hidden" name="vinDecodeWarning" value={vinDecodeWarning ? '1' : '0'} />

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
        <h3 className="col-span-full text-xl font-semibold leading-7 text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-gray-800 pb-2">
          Customer
        </h3>

        <div className="sm:col-span-2">
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">
            Phone number <span className="text-sm text-zinc-500 dark:text-gray-500">(SMS link)</span>
          </label>
          <CanadianPhoneInput
            name="phone"
            required
            value={phone}
            onChange={setPhone}
            placeholder="416 - 123 - 4567"
            className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500"
          />
        </div>

        <h3 className="col-span-full text-xl font-semibold leading-7 text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-gray-800 pb-2 mt-4">
          Vehicle (from VIN)
        </h3>

        <div className="sm:col-span-2">
          <VinDecodeField
            disabled={isPending}
            onDecoded={applyVinDecodeFields}
            onDecodeFailed={onVinDecodeFailed}
            onPendingChange={setVinDecodePending}
            inputClassName="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white"
          />
        </div>

        {vinDecodeWarning ? (
          <VinManualVehicleFields
            vehicleYear={vehicleYear}
            vehicleMake={selectedMake}
            vehicleModel={customModel || vehicleModelForSubmit}
            onVehicleYear={setVehicleYear}
            onVehicleMake={setSelectedMake}
            onVehicleModel={(v) => {
              setCustomModel(v)
              setSelectedModel('__custom__')
            }}
            inputClassName="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white"
            disabled={isPending}
          />
        ) : vehicleReady ? (
          <p className="sm:col-span-2 text-sm text-zinc-600 dark:text-gray-400">
            {vehicleYear} {selectedMake} {vehicleModelForSubmit}
            {vinLast6 ? ` · VIN …${vinLast6}` : ''}
          </p>
        ) : null}

        <div>
          <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">
            Stock number <span className="text-sm font-normal text-zinc-500 dark:text-gray-500">(optional)</span>
          </label>
          <input
            name="stockNumber"
            value={stockNumber}
            onChange={e => setStockNumber(e.target.value.toUpperCase())}
            style={{ textTransform: 'uppercase' }}
            className="mt-1.5 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2.5 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] text-base text-zinc-900 dark:text-white"
            placeholder="Enter stock number"
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
                    {camera.label ?? camera.name}
                  </option>
                ))}
              </select>
              {!selectedCamera && (
                <p className="text-sm text-zinc-500 dark:text-gray-500">Please select a camera model</p>
              )}
              {selectedCamera && (
                <input
                  type="hidden"
                  name="cameraModel"
                  value={selectedCamera}
                  required
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1.5">
              No cameras are assigned to your dealer for booking. Ask an Aurora Manager to assign camera models in
              System Management before creating a demand.
            </p>
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
            getTakenSlots={(dateStr) =>
              dealerId
                ? getPoolSlotContext(dealerId, dateStr).then((ctx) => ctx.appointments)
                : Promise.resolve([])
            }
          />
        </div>

        {selectedDate && (() => {
            const isoDow = getISODay(toDate(`${selectedDate}T12:00:00`, { timeZone: SYSTEM_DEFAULT_TIMEZONE }))
            if (isIsoDowClosed(weeklyClosedIsoDays, isoDow)) {
              return (
                <div className="space-y-2">
                  <label className="block text-base font-medium text-zinc-600 dark:text-gray-300">Available Slots</label>
                  <p className="text-sm text-zinc-500 dark:text-gray-400">This dealer is closed on this day of the week.</p>
                </div>
              )
            }
            const setting = resolveCalendarSettingForIsoDow(calendarSettings, isoDow)
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

                const overlapCount = countOverlapsAtSlot(
                  slotStart,
                  slotEnd,
                  takenSlots.map((appointment_date) => ({ appointment_date }))
                )
                if (overlapCount >= poolCapacity) return false

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
              vinDecodePending ||
              !vehicleReady ||
              !phone.trim() ||
              !selectedSlot ||
              cameraModels.length === 0 ||
              !selectedCamera
            }
            className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-[#C27E00] py-2.5 px-5 text-base font-semibold text-white shadow-sm hover:bg-[#a06900] focus:outline-none focus:ring-2 focus:ring-[#C27E00] focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Submitting…' : 'Create appointment & send link'}
          </button>
        </div>
      </div>
    </form>
  )
}

