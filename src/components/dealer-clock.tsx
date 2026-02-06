'use client'

import { useEffect, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'

interface DealerClockProps {
  timezoneName: string | null
  timezoneDisplayName?: string
}

export function DealerClock({ timezoneName, timezoneDisplayName }: DealerClockProps) {
  const [currentTime, setCurrentTime] = useState<string>('')

  useEffect(() => {
    if (!timezoneName) {
      // If no timezone, use local time
      const updateTime = () => {
        const now = new Date()
        setCurrentTime(formatInTimeZone(now, Intl.DateTimeFormat().resolvedOptions().timeZone, 'HH:mm:ss'))
      }
      updateTime()
      const interval = setInterval(updateTime, 1000)
      return () => clearInterval(interval)
    }

    const updateTime = () => {
      const now = new Date()
      setCurrentTime(formatInTimeZone(now, timezoneName, 'HH:mm:ss'))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [timezoneName])

  if (!timezoneName) {
    return null
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-300">
      <span className="text-[#C27E00] font-medium">{currentTime}</span>
      {timezoneDisplayName && (
        <span className="text-gray-500 text-xs">({timezoneDisplayName})</span>
      )}
    </div>
  )
}

