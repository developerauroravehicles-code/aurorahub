'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatInTimeZone, toDate } from 'date-fns-tz'
import { getISODay } from 'date-fns'
import { createQuickDealerDemand } from './actions'
import { VinDecodeField } from '@/components/vin-decode-field'
import type { DemandVehicleFieldsFromVin } from '@/lib/vin-decode/map-to-demand-vehicle'
import { AppointmentCalendar } from '@/components/appointment-calendar'
import {
  resolveCalendarSettingForIsoDow,
  isIsoDowClosed,
  type DealerCalendarSettingsMap,
} from '@/lib/dealer-calendar-day-type'
import {
  CALENDAR_DEFAULTS,
  dealerCalendarRowToSlotConfig,
  getGlobalSlotMinutes,
  getSlotMinutesFromConfig,
} from '@/lib/calendar-defaults'
import { getDealerBlocksForDate, getPoolSlotContext } from '@/app/dashboard/system-management/calendar/actions'
import { countOverlapsAtSlot } from '@/lib/scheduling-pool'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { pad2 } from '@/lib/calendar-wall-date'
import { useTimezone } from '@/contexts/timezone-context'
import { useSystemTime } from '@/contexts/system-time-context'

type CameraRow = { id: string; name: string; label?: string | null }

type Props = {
  cameraModels: CameraRow[]
  dealerId: string | null
  timezoneName: string | null
  calendarSettings: DealerCalendarSettingsMap
  weeklyClosedIsoDays: number[]
}

export function QuickDemandForm({
  cameraModels,
  dealerId,
  timezoneName: propTimezone,
  calendarSettings,
  weeklyClosedIsoDays,
}: Props) {
  const router = useRouter()
  const contextTimezone = useTimezone()
  const timezoneName = propTimezone ?? contextTimezone
  const systemNow = useSystemTime()
  const [state, formAction, isPending] = useActionState(createQuickDealerDemand, null)

  const [vinLast6, setVinLast6] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [selectedMake, setSelectedMake] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [vehicleReady, setVehicleReady] = useState(false)
  const [phone, setPhone] = useState('')
  const [stockNumber, setStockNumber] = useState('')
  const [selectedCamera, setSelectedCamera] = useState(cameraModels[0]?.name ?? '')

  const [selectedDate, setSelectedDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [poolCapacity, setPoolCapacity] = useState(1)
  const [dealerBlocks, setDealerBlocks] = useState<{ start_minutes: number; end_minutes: number }[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')

  const onVinDecoded = (fields: DemandVehicleFieldsFromVin) => {
    setVinLast6(fields.vinLast6)
    setVehicleYear(fields.vehicleYear)
    setSelectedMake(fields.selectedMake || fields.rawMake)
    setSelectedModel(fields.selectedModel || fields.customModel || fields.rawModel)
    setCustomModel(fields.customModel)
    setVehicleReady(Boolean(fields.vehicleYear && (fields.selectedMake || fields.rawMake)))
  }

  useEffect(() => {
    if (selectedDate && dealerId) {
      getPoolSlotContext(dealerId, selectedDate).then(({ appointments, capacity }) => {
        setTakenSlots(appointments)
        setPoolCapacity(capacity)
      })
    }
  }, [selectedDate, dealerId])

  useEffect(() => {
    if (dealerId && selectedDate) {
      getDealerBlocksForDate(dealerId, selectedDate).then(setDealerBlocks)
    } else {
      setDealerBlocks([])
    }
  }, [dealerId, selectedDate])

  useEffect(() => {
    if (!selectedDate) return
    const ptTz = SYSTEM_DEFAULT_TIMEZONE
    const isoDow = getISODay(toDate(`${selectedDate}T12:00:00`, { timeZone: ptTz }))
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
      const wall = `${selectedDate}T${pad2(h)}:${pad2(m)}:00`
      const utcMoment = toDate(wall, { timeZone: ptTz })
      if (utcMoment.getTime() > nowMs) {
        slots.push(utcMoment.toISOString())
      }
    }
    setAvailableSlots(slots)
  }, [selectedDate, calendarSettings, weeklyClosedIsoDays, systemNow])

  useEffect(() => {
    if (state && 'success' in state && state.success) {
      const t = setTimeout(() => {
        router.push('/dashboard/sales/demands')
        router.refresh()
      }, 4000)
      return () => clearTimeout(t)
    }
  }, [state, router])

  const vehicleModelValue = selectedModel || customModel

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-zinc-600 dark:text-gray-400">
        Stock, VIN, and phone only — vehicle data from VIN decode. Customer gets an SMS link to confirm name and phone.
      </p>

      {state && 'error' in state && state.error && (
        <div className="bg-red-50 text-red-600 dark:bg-red-950/50 p-3 rounded-md text-sm border border-red-100">
          {state.error}
        </div>
      )}

      {state && 'success' in state && state.success && (
        <div className="bg-green-50 text-green-800 dark:bg-green-950/40 p-4 rounded-md text-sm space-y-2">
          <p>
            Appointment #{state.demandNumber ?? '—'} created.
            {state.smsSent ? ' Link sent by SMS.' : state.smsError ? ` SMS: ${state.smsError}` : ''}
          </p>
          {state.portalUrl && (
            <p className="break-all text-xs font-mono">{state.portalUrl}</p>
          )}
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="vinLast6" value={vinLast6} />
        <input type="hidden" name="vehicleMake" value={selectedMake} />
        <input type="hidden" name="vehicleModel" value={vehicleModelValue} />
        <input type="hidden" name="vehicleYear" value={vehicleYear} />
        <input type="hidden" name="appointmentDate" value={selectedSlot} />
        <input type="hidden" name="cameraModel" value={selectedCamera} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Stock number</label>
            <input
              name="stockNumber"
              required
              value={stockNumber}
              onChange={e => setStockNumber(e.target.value.toUpperCase())}
              className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Customer phone</label>
            <input
              name="phone"
              required
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <VinDecodeField onDecoded={onVinDecoded} />
        {vehicleReady && (
          <p className="text-xs text-zinc-500">
            {vehicleYear} {selectedMake} {vehicleModelValue} · VIN …{vinLast6}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Camera</label>
          <select
            required
            value={selectedCamera}
            onChange={e => setSelectedCamera(e.target.value)}
            className="w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-3 py-2 text-sm"
          >
            {cameraModels.map(c => (
              <option key={c.id} value={c.name}>
                {c.label ?? c.name}
              </option>
            ))}
          </select>
        </div>

        <AppointmentCalendar
          timezoneName={SYSTEM_DEFAULT_TIMEZONE}
          selectedPacificYmd={selectedDate}
          onDateSelect={date => {
            const dateStr = formatInTimeZone(date, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
            setSelectedDate(dateStr)
            setSelectedSlot('')
          }}
          getTakenSlots={dateStr =>
            dealerId ? getPoolSlotContext(dealerId, dateStr).then(ctx => ctx.appointments) : Promise.resolve([])
          }
        />

        {selectedDate && (() => {
          const isoDow = getISODay(toDate(`${selectedDate}T12:00:00`, { timeZone: SYSTEM_DEFAULT_TIMEZONE }))
          if (isIsoDowClosed(weeklyClosedIsoDays, isoDow)) {
            return <p className="text-sm text-zinc-500">Dealer closed this weekday.</p>
          }
          const setting = resolveCalendarSettingForIsoDow(calendarSettings, isoDow)
          const duration = setting?.appointment_duration_minutes ?? CALENDAR_DEFAULTS.appointmentDurationMinutes
          const today = formatInTimeZone(systemNow, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
          const nowMs = systemNow.getTime()
          const slots = availableSlots.filter(slot => {
            const slotStart = new Date(slot).getTime()
            if (selectedDate === today && slotStart <= nowMs) return false
            const slotEnd = slotStart + duration * 60 * 1000
            if (countOverlapsAtSlot(slotStart, slotEnd, takenSlots.map(d => ({ appointment_date: d }))) >= poolCapacity)
              return false
            const slotStartMinutes =
              parseInt(formatInTimeZone(new Date(slot), SYSTEM_DEFAULT_TIMEZONE, 'H'), 10) * 60 +
              parseInt(formatInTimeZone(new Date(slot), SYSTEM_DEFAULT_TIMEZONE, 'm'), 10)
            const slotEndMinutes = slotStartMinutes + duration
            if (dealerBlocks.some(b => slotStartMinutes < b.end_minutes && slotEndMinutes > b.start_minutes))
              return false
            return true
          })
          return (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Time slot</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {slots.map(slot => {
                  const label = formatInTimeZone(new Date(slot), timezoneName ?? SYSTEM_DEFAULT_TIMEZONE, 'h:mm a')
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        selectedSlot === slot
                          ? 'border-[#C27E00] bg-[#C27E00]/10 text-[#C27E00]'
                          : 'border-zinc-300 dark:border-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        <button
          type="submit"
          disabled={isPending || !vehicleReady || !selectedSlot || !selectedCamera}
          className="w-full rounded-md bg-[#C27E00] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create & send customer link'}
        </button>
      </form>
    </div>
  )
}