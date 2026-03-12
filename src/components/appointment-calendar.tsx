'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useTimezone } from '@/contexts/timezone-context'
import { useSystemTime } from '@/contexts/system-time-context'

interface AppointmentCalendarProps {
  timezoneName?: string | null
  onDateSelect: (date: Date) => void
  selectedDate?: Date | null
  getTakenSlots: (dateStr: string) => Promise<string[]>
  /** When true, past dates are selectable (e.g. external retroactive demands) */
  allowPastDates?: boolean
}

export function AppointmentCalendar({ 
  timezoneName: propTimezone, 
  onDateSelect, 
  selectedDate,
  getTakenSlots,
  allowPastDates = false
}: AppointmentCalendarProps) {
  const now = useSystemTime()
  const contextTz = useTimezone()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [takenDates, setTakenDates] = useState<Set<string>>(new Set())
  const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set())

  // System timezone (Pacific) - must match top-left clock exactly
  const systemTz = propTimezone ?? contextTz

  // Get all dates in the current month view (including previous/next month days for full weeks)
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 }) // Monday
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Load taken slots for the current month
  useEffect(() => {
    const loadTakenSlots = async () => {
      setLoadingDates(new Set())
      const newTakenDates = new Set<string>()
      
      // Get all days in the current month view
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
      const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
      
      // Load for each day - use Pacific date string for consistency with system
      for (const day of allDays) {
        const dateStr = formatInTimeZone(day, systemTz, 'yyyy-MM-dd')
        setLoadingDates(prev => new Set(prev).add(dateStr))
        
        try {
          const takenSlots = await getTakenSlots(dateStr)
          if (takenSlots.length > 0) {
            newTakenDates.add(dateStr)
          }
        } catch (error) {
          console.error('Error loading taken slots:', error)
        }
        
        setLoadingDates(prev => {
          const next = new Set(prev)
          next.delete(dateStr)
          return next
        })
      }
      
      setTakenDates(newTakenDates)
    }

    loadTakenSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, systemTz])

  // Same "now" and timezone as DealerClock - calendar fully integrated with system
  const getTodayInTz = useCallback(() => {
    return formatInTimeZone(now, systemTz, 'yyyy-MM-dd')
  }, [systemTz, now])

  // All date logic in Pacific - avoid local-timezone drift (e.g. cell shows "24" but hover shows "25")
  const getDateStrInPacific = (date: Date) => formatInTimeZone(date, systemTz, 'yyyy-MM-dd')

  const handleDateClick = (date: Date) => {
    const dateStr = getDateStrInPacific(date)
    const todayStr = getTodayInTz()
    const isPast = dateStr < todayStr

    if (isSameMonth(date, currentMonth) && (allowPastDates || !isPast)) {
      onDateSelect(date)
    }
  }

  const isPastDate = (date: Date) => {
    const dateStr = getDateStrInPacific(date)
    const todayStr = getTodayInTz()
    return dateStr < todayStr
  }

  const isPastMonth = (month: Date) => {
    const lastDayStr = formatInTimeZone(endOfMonth(month), systemTz, 'yyyy-MM-dd')
    const todayStr = getTodayInTz()
    return lastDayStr < todayStr
  }

  const formatDateForDisplay = (date: Date) => {
    return formatInTimeZone(date, systemTz, 'd')
  }

  const formatMonthYear = () => {
    return formatInTimeZone(currentMonth, systemTz, 'MMMM yyyy')
  }

  const isToday = (date: Date) => {
    const dateStr = getDateStrInPacific(date)
    return dateStr === getTodayInTz()
  }

  const isSelected = (date: Date) => {
    return selectedDate && isSameDay(date, selectedDate)
  }

  const isTaken = (date: Date) => {
    const dateStr = getDateStrInPacific(date)
    return takenDates.has(dateStr)
  }

  const isLoading = (date: Date) => {
    const dateStr = getDateStrInPacific(date)
    return loadingDates.has(dateStr)
  }

  return (
    <div className="bg-white/5 border border-gray-800 rounded-lg p-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          disabled={!allowPastDates && isPastMonth(subMonths(currentMonth, 1))}
          className={`p-2 rounded transition-colors ${(!allowPastDates && isPastMonth(subMonths(currentMonth, 1))) ? 'cursor-not-allowed opacity-40' : 'hover:bg-white/10'}`}
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h3 className="text-lg font-semibold text-white">{formatMonthYear()}</h3>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-white/10 rounded transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Day Names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-400 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const dayIsToday = isToday(day)
          const dayIsSelected = isSelected(day)
          const dayIsTaken = isTaken(day)
          const dayIsLoading = isLoading(day)
          const dayIsPast = isPastDate(day)

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDateClick(day)}
              disabled={!isCurrentMonth || dayIsLoading || (!allowPastDates && dayIsPast)}
              className={`
                aspect-square p-2 rounded text-sm font-medium transition-colors relative
                ${!isCurrentMonth 
                  ? 'text-gray-600 cursor-not-allowed' 
                  : dayIsPast && !allowPastDates
                  ? 'text-gray-500 bg-gray-900/50 cursor-not-allowed opacity-60 border border-gray-800'
                  : dayIsPast && allowPastDates
                  ? 'text-gray-400 bg-gray-800/50 hover:bg-white/10 border border-gray-700'
                  : dayIsSelected
                  ? 'bg-[#C27E00] text-white'
                  : dayIsToday
                  ? 'bg-blue-900/30 text-blue-200 border border-blue-800'
                  : dayIsTaken
                  ? 'bg-red-900/30 text-red-200 border border-red-800'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
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
                  : getDateStrInPacific(day)
              }
            >
              {formatDateForDisplay(day)}
              {dayIsPast && isCurrentMonth && !allowPastDates && (
                <Lock className="w-2.5 h-2.5 text-gray-500 absolute top-1 right-1" />
              )}
              {dayIsTaken && !dayIsPast && (
                <div className="w-1 h-1 bg-red-400 rounded-full mx-auto mt-1" />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[#C27E00] rounded" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-900/30 border border-blue-800 rounded" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-900/50 border border-gray-800 rounded flex items-center justify-center">
            <Lock className="w-2 h-2 text-gray-500" />
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

