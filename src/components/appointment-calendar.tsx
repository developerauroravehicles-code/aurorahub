'use client'

import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AppointmentCalendarProps {
  timezoneName: string | null
  onDateSelect: (date: Date) => void
  selectedDate?: Date | null
  getTakenSlots: (dateStr: string) => Promise<string[]>
}

export function AppointmentCalendar({ 
  timezoneName, 
  onDateSelect, 
  selectedDate,
  getTakenSlots 
}: AppointmentCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [takenDates, setTakenDates] = useState<Set<string>>(new Set())
  const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set())

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
      
      // Load for each day in the visible calendar
      for (const day of allDays) {
        const dateStr = format(day, 'yyyy-MM-dd')
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
  }, [currentMonth])

  const handleDateClick = (date: Date) => {
    // Only allow selecting dates in the current month and not in the past
    const today = startOfDay(new Date())
    const selectedDay = startOfDay(date)
    
    if (isSameMonth(date, currentMonth) && !isBefore(selectedDay, today)) {
      onDateSelect(date)
    }
  }

  const isPastDate = (date: Date) => {
    const today = startOfDay(new Date())
    const selectedDay = startOfDay(date)
    return isBefore(selectedDay, today)
  }

  const formatDateForDisplay = (date: Date) => {
    if (timezoneName) {
      return formatInTimeZone(date, timezoneName, 'd')
    }
    return format(date, 'd')
  }

  const formatMonthYear = () => {
    if (timezoneName) {
      return formatInTimeZone(currentMonth, timezoneName, 'MMMM yyyy')
    }
    return format(currentMonth, 'MMMM yyyy')
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return isSameDay(date, today)
  }

  const isSelected = (date: Date) => {
    return selectedDate && isSameDay(date, selectedDate)
  }

  const isTaken = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return takenDates.has(dateStr)
  }

  const isLoading = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return loadingDates.has(dateStr)
  }

  return (
    <div className="bg-white/5 border border-gray-800 rounded-lg p-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:bg-white/10 rounded transition-colors"
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
              disabled={!isCurrentMonth || dayIsLoading || dayIsPast}
              className={`
                aspect-square p-2 rounded text-sm font-medium transition-colors
                ${!isCurrentMonth 
                  ? 'text-gray-600 cursor-not-allowed' 
                  : dayIsPast
                  ? 'text-gray-600 bg-white/5 cursor-not-allowed opacity-50'
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
                dayIsPast 
                  ? 'Past dates cannot be selected' 
                  : dayIsTaken 
                  ? 'Has appointments' 
                  : format(day, 'yyyy-MM-dd')
              }
            >
              {formatDateForDisplay(day)}
              {dayIsTaken && (
                <div className="w-1 h-1 bg-red-400 rounded-full mx-auto mt-1" />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[#C27E00] rounded" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-900/30 border border-blue-800 rounded" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-900/30 border border-red-800 rounded" />
          <span>Has Appointments</span>
        </div>
      </div>
    </div>
  )
}

