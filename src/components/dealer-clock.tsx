'use client'

import { useEffect, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'

interface DealerClockProps {
  timezoneName: string | null
  timezoneDisplayName?: string
}

export function DealerClock({ timezoneName, timezoneDisplayName }: DealerClockProps) {
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')

  useEffect(() => {
    if (!timezoneName) {
      // If no timezone, use local time
      const updateTime = () => {
        const now = new Date()
        const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
        setCurrentTime(formatInTimeZone(now, localTz, 'HH:mm:ss'))
        setCurrentDate(formatInTimeZone(now, localTz, 'MMM dd, yyyy'))
      }
      updateTime()
      const interval = setInterval(updateTime, 1000)
      return () => clearInterval(interval)
    }

    const updateTime = () => {
      const now = new Date()
      setCurrentTime(formatInTimeZone(now, timezoneName, 'HH:mm:ss'))
      setCurrentDate(formatInTimeZone(now, timezoneName, 'MMM dd, yyyy'))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [timezoneName])

  if (!timezoneName) {
    return null
  }

  return (
    <div className="flex flex-col gap-1 text-sm bg-black/80 backdrop-blur-sm border border-[#C27E00]/30 rounded-lg px-4 py-2 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-[#C27E00] font-semibold text-base">{currentTime}</span>
        {timezoneDisplayName && (
          <span className="text-white/80 text-xs">({timezoneDisplayName})</span>
        )}
      </div>
      <div className="text-white/70 text-xs">{currentDate}</div>
    </div>
  )
}

