'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { formatInTimeZone, toDate } from 'date-fns-tz'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useTimezone } from '@/contexts/timezone-context'
import { useSystemTime } from '@/contexts/system-time-context'
import {
  gregorianMondayFirstGrid,
  addGregorianMonths,
  utcDaysInGregorianMonth,
  pad2,
} from '@/lib/calendar-wall-date'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

interface AppointmentCalendarProps {
  timezoneName?: string | null
  onDateSelect: (date: Date) => void
  selectedDate?: Date | null
  /** yyyy-MM-dd in `timezoneName` — avoids parsing bugs from `selectedDate` in the browser TZ */
  selectedPacificYmd?: string | null
  getTakenSlots: (dateStr: string) => Promise<string[]>
  /** When true, past dates are selectable (e.g. external retroactive demands) */
  allowPastDates?: boolean
}

export function AppointmentCalendar({
  timezoneName: propTimezone,
  onDateSelect,
  selectedDate,
  selectedPacificYmd,
  getTakenSlots,
  allowPastDates = false,
}: AppointmentCalendarProps) {
  const now = useSystemTime()
  const contextTz = useTimezone()
  const systemTz = propTimezone ?? contextTz ?? SYSTEM_DEFAULT_TIMEZONE
  const [takenDates, setTakenDates] = useState<Set<string>>(new Set())
  const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set())

  const [viewYm, setViewYm] = useState<{ y: number; m: number }>(() => {
    const tz = propTimezone ?? SYSTEM_DEFAULT_TIMEZONE
    const [y, m] = formatInTimeZone(new Date(), tz, 'yyyy-MM').split('-').map(Number)
    return { y, m }
  })

  const gridDays = useMemo(() => gregorianMondayFirstGrid(viewYm.y, viewYm.m), [viewYm.y, viewYm.m])

  const displayYmds = useMemo(() => gridDays.map((c) => c.ymd), [gridDays])

  // When parent supplies a selected wall date, keep the visible month in sync
  useEffect(() => {
    if (!selectedPacificYmd || !/^\d{4}-\d{2}-\d{2}$/.test(selectedPacificYmd)) return
    const [y, m] = selectedPacificYmd.split('-').map(Number)
    if (Number.isFinite(y) && Number.isFinite(m)) {
      setViewYm((prev) => (prev.y === y && prev.m === m ? prev : { y, m }))
    }
  }, [selectedPacificYmd])

  useEffect(() => {
    const loadTakenSlots = async () => {
      setLoadingDates(new Set())
      const newTakenDates = new Set<string>()

      for (const ymd of displayYmds) {
        setLoadingDates((prev) => new Set(prev).add(ymd))
        try {
          const takenSlots = await getTakenSlots(ymd)
          if (takenSlots.length > 0) {
            newTakenDates.add(ymd)
          }
        } catch (error) {
          console.error('Error loading taken slots:', error)
        }
        setLoadingDates((prev) => {
          const next = new Set(prev)
          next.delete(ymd)
          return next
        })
      }

      setTakenDates(newTakenDates)
    }

    void loadTakenSlots()
  }, [viewYm.y, viewYm.m, systemTz, displayYmds])

  const getTodayInTz = useCallback(() => formatInTimeZone(now, systemTz, 'yyyy-MM-dd'), [systemTz, now])

  const handleYmdClick = (ymd: string, inMonth: boolean) => {
    const todayStr = getTodayInTz()
    const isPast = ymd < todayStr
    if (!inMonth || (!allowPastDates && isPast)) return
    onDateSelect(toDate(`${ymd}T12:00:00`, { timeZone: systemTz }))
  }

  const isPastYmd = (ymd: string) => ymd < getTodayInTz()

  const isPastViewMonth = (y: number, m: number) => {
    const dim = utcDaysInGregorianMonth(y, m)
    const lastYmd = `${y}-${pad2(m)}-${pad2(dim)}`
    return lastYmd < getTodayInTz()
  }

  const formatMonthYear = () =>
    formatInTimeZone(toDate(`${viewYm.y}-${pad2(viewYm.m)}-01T12:00:00`, { timeZone: systemTz }), systemTz, 'MMMM yyyy')

  const isSelectedYmd = (ymd: string) => {
    if (selectedPacificYmd && selectedPacificYmd === ymd) return true
    if (selectedDate) {
      const asStr = formatInTimeZone(selectedDate, systemTz, 'yyyy-MM-dd')
      return asStr === ymd
    }
    return false
  }

  const prevYm = addGregorianMonths(viewYm.y, viewYm.m, -1)
  const nextYm = addGregorianMonths(viewYm.y, viewYm.m, 1)

  return (
    <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-4 sm:p-5 text-base">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setViewYm(prevYm)}
          disabled={!allowPastDates && isPastViewMonth(prevYm.y, prevYm.m)}
          className={`p-2 rounded transition-colors ${
            !allowPastDates && isPastViewMonth(prevYm.y, prevYm.m)
              ? 'cursor-not-allowed opacity-40'
              : 'hover:bg-zinc-200 dark:hover:bg-white/10'
          }`}
        >
          <ChevronLeft className="w-5 h-5 text-zinc-900 dark:text-white" />
        </button>
        <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">{formatMonthYear()}</h3>
        <button
          type="button"
          onClick={() => setViewYm(nextYm)}
          className="p-2 hover:bg-zinc-200 dark:hover:bg-white/10 rounded transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-zinc-900 dark:text-white" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-zinc-500 dark:text-gray-400 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {gridDays.map(({ ymd, inMonth }, idx) => {
          const [, , dd] = ymd.split('-')
          const dayIsToday = ymd === getTodayInTz()
          const dayIsSelected = isSelectedYmd(ymd)
          const dayIsTaken = takenDates.has(ymd)
          const dayIsLoading = loadingDates.has(ymd)
          const dayIsPast = isPastYmd(ymd)

          return (
            <button
              key={`${ymd}-${idx}`}
              type="button"
              onClick={() => handleYmdClick(ymd, inMonth)}
              disabled={!inMonth || dayIsLoading || (!allowPastDates && dayIsPast)}
              className={`
                aspect-square p-2 rounded text-base font-medium transition-colors relative min-h-[40px] sm:min-h-0
                ${
                  !inMonth
                    ? 'text-zinc-600 dark:text-gray-600 cursor-not-allowed'
                    : dayIsPast && !allowPastDates
                      ? 'text-zinc-500 dark:text-gray-500 bg-zinc-200/80 dark:bg-gray-900/50 cursor-not-allowed opacity-60 border border-zinc-200 dark:border-gray-800'
                      : dayIsPast && allowPastDates
                        ? 'text-zinc-500 dark:text-gray-400 bg-gray-800/50 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-300 dark:border-gray-700'
                        : dayIsSelected
                          ? 'bg-[#C27E00] text-white'
                          : dayIsToday
                            ? 'bg-blue-900/30 text-blue-200 border border-blue-800'
                            : dayIsTaken
                              ? 'bg-red-900/30 text-red-200 border border-red-800'
                              : 'bg-zinc-200/50 dark:bg-white/5 text-zinc-600 dark:text-gray-300 hover:bg-zinc-200 dark:hover:bg-white/10'
                }
                ${dayIsLoading ? 'opacity-50 cursor-wait' : ''}
              `}
              title={
                dayIsPast && !allowPastDates
                  ? 'Closed - past date'
                  : dayIsPast && allowPastDates
                    ? 'Select (retroactive)'
                    : dayIsTaken
                      ? 'Has appointments'
                      : ymd
              }
            >
              {String(parseInt(dd, 10))}
              {dayIsPast && inMonth && !allowPastDates && (
                <Lock className="w-2.5 h-2.5 text-zinc-500 dark:text-gray-500 absolute top-1 right-1" />
              )}
              {dayIsTaken && !dayIsPast && (
                <div className="w-1 h-1 bg-red-400 rounded-full mx-auto mt-1" />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-zinc-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[#C27E00] rounded" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-900/30 border border-blue-800 rounded" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-zinc-200/80 dark:bg-gray-900/50 border border-zinc-200 dark:border-gray-800 rounded flex items-center justify-center">
            <Lock className="w-2 h-2 text-zinc-500 dark:text-gray-500" />
          </div>
          <span>Closed (past)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-900/30 border border-red-800 rounded" />
          <span>Has Appointments</span>
        </div>
      </div>
    </div>
  )
}
