'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatInTimeZone, toDate } from 'date-fns-tz'
import { getISODay } from 'date-fns'
import { AppointmentCalendar } from '@/components/appointment-calendar'
import {
  getCalendarSettingsForDealer,
  getDealerBlocksForDate,
  getPoolSlotContext,
} from '@/app/dashboard/system-management/calendar/actions'
import { CALENDAR_DEFAULTS, getGlobalSlotMinutes, getSlotMinutesFromConfig } from '@/lib/calendar-defaults'
import { countOverlapsAtSlot } from '@/lib/scheduling-pool'
import { pad2 } from '@/lib/calendar-wall-date'
import {
  isIsoDowClosed,
  resolveCalendarSettingForIsoDow,
  type DealerCalendarSettingsMap,
} from '@/lib/dealer-calendar-day-type'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { useSystemTime } from '@/contexts/system-time-context'

type Props = {
  dealerId: string
  dealerName?: string
  appointmentIso: string
  onAppointmentIsoChange: (iso: string) => void
}

export function ServiceAppointmentScheduler({
  dealerId,
  dealerName,
  appointmentIso,
  onAppointmentIsoChange,
}: Props) {
  const systemNow = useSystemTime()
  const [calendarSettings, setCalendarSettings] = useState<DealerCalendarSettingsMap>({})
  const [weeklyClosedIsoDays, setWeeklyClosedIsoDays] = useState<number[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [poolCapacity, setPoolCapacity] = useState(1)
  const [dealerBlocks, setDealerBlocks] = useState<{ start_minutes: number; end_minutes: number }[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)

  useEffect(() => {
    if (!dealerId) return
    setLoadingSettings(true)
    void getCalendarSettingsForDealer(dealerId).then(({ settings, closedIsoDays }) => {
      setCalendarSettings(settings)
      setWeeklyClosedIsoDays(closedIsoDays)
      setLoadingSettings(false)
    })
  }, [dealerId])

  useEffect(() => {
    if (appointmentIso) {
      const ymd = formatInTimeZone(new Date(appointmentIso), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
      setSelectedDate(ymd)
    }
  }, [appointmentIso])

  useEffect(() => {
    if (selectedDate && dealerId) {
      void getPoolSlotContext(dealerId, selectedDate).then(({ appointments, capacity }) => {
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
      void getDealerBlocksForDate(dealerId, selectedDate).then(setDealerBlocks)
    } else {
      setDealerBlocks([])
    }
  }, [dealerId, selectedDate])

  useEffect(() => {
    if (!selectedDate) {
      setAvailableSlots([])
      return
    }
    const isoDow = getISODay(toDate(`${selectedDate}T12:00:00`, { timeZone: SYSTEM_DEFAULT_TIMEZONE }))
    if (isIsoDowClosed(weeklyClosedIsoDays, isoDow)) {
      setAvailableSlots([])
      return
    }
    const setting = resolveCalendarSettingForIsoDow(calendarSettings, isoDow)
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
      const wall = `${selectedDate}T${pad2(h)}:${pad2(m)}:00`
      const utcMoment = toDate(wall, { timeZone: SYSTEM_DEFAULT_TIMEZONE })
      if (utcMoment.getTime() > nowMs) {
        slots.push(utcMoment.toISOString())
      }
    }
    setAvailableSlots(slots)
  }, [selectedDate, calendarSettings, weeklyClosedIsoDays, systemNow])

  const selectableSlots = useMemo(() => {
    if (!selectedDate) return []
    const setting = resolveCalendarSettingForIsoDow(
      calendarSettings,
      getISODay(toDate(`${selectedDate}T12:00:00`, { timeZone: SYSTEM_DEFAULT_TIMEZONE }))
    )
    const appointmentDurationMinutes =
      setting?.appointment_duration_minutes ?? CALENDAR_DEFAULTS.appointmentDurationMinutes
    const todayInPacific = formatInTimeZone(systemNow, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
    const nowMs = systemNow.getTime()

    return availableSlots.filter((slot) => {
      const slotTime = new Date(slot)
      const slotStart = slotTime.getTime()
      const slotEnd = slotStart + appointmentDurationMinutes * 60 * 1000
      if (selectedDate === todayInPacific && slotStart <= nowMs) return false

      const overlapCount = countOverlapsAtSlot(
        slotStart,
        slotEnd,
        takenSlots.map((appointment_date) => ({ appointment_date }))
      )
      if (overlapCount >= poolCapacity) return false

      const startMinutes =
        parseInt(formatInTimeZone(slotTime, SYSTEM_DEFAULT_TIMEZONE, 'H'), 10) * 60 +
        parseInt(formatInTimeZone(slotTime, SYSTEM_DEFAULT_TIMEZONE, 'm'), 10)
      const endMinutes = startMinutes + appointmentDurationMinutes

      for (const block of dealerBlocks) {
        if (startMinutes < block.end_minutes && endMinutes > block.start_minutes) {
          return false
        }
      }
      return true
    })
  }, [
    availableSlots,
    calendarSettings,
    dealerBlocks,
    poolCapacity,
    selectedDate,
    systemNow,
    takenSlots,
  ])

  const selectedPacificYmd = appointmentIso
    ? formatInTimeZone(new Date(appointmentIso), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
    : selectedDate || null

  return (
    <div className="space-y-3">
      {dealerName ? (
        <p className="text-sm text-zinc-600 dark:text-gray-400">
          Dealer calendar: <span className="font-medium text-zinc-900 dark:text-white">{dealerName}</span>
          <span className="text-zinc-500"> (Pacific Time slots)</span>
        </p>
      ) : null}
      {loadingSettings ? (
        <p className="text-xs text-zinc-500">Loading dealer calendar…</p>
      ) : (
        <>
          <AppointmentCalendar
            timezoneName={SYSTEM_DEFAULT_TIMEZONE}
            selectedPacificYmd={selectedPacificYmd}
            onDateSelect={(date) => {
              const dateStr = formatInTimeZone(date, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
              setSelectedDate(dateStr)
              onAppointmentIsoChange('')
            }}
            getTakenSlots={(dateStr) =>
              dealerId
                ? getPoolSlotContext(dealerId, dateStr).then((ctx) => ctx.appointments)
                : Promise.resolve([])
            }
          />
          {selectedDate ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Available slots
              </label>
              {selectableSlots.length === 0 ? (
                <p className="text-sm text-zinc-500">No open slots on this day for this dealer.</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                  {selectableSlots.map((slot) => {
                    const label = formatInTimeZone(slot, SYSTEM_DEFAULT_TIMEZONE, 'h:mm a')
                    const selected = appointmentIso === slot
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => onAppointmentIsoChange(slot)}
                        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? 'border-[#C27E00] bg-[#C27E00]/15 text-[#C27E00]'
                            : 'border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-gray-200 hover:border-[#C27E00]/50'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Select a date on the calendar.</p>
          )}
        </>
      )}
    </div>
  )
}
