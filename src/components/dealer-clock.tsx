'use client'

import { useEffect, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'

interface DealerClockProps {
  timezoneName: string | null
  timezoneDisplayName?: string
}

export function DealerClock({ timezoneName, timezoneDisplayName }: DealerClockProps) {
  const [timePart, setTimePart] = useState<string>('')
  const [periodPart, setPeriodPart] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')

  useEffect(() => {
    if (!timezoneName) {
      const updateTime = () => {
        const now = new Date()
        const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
        setTimePart(formatInTimeZone(now, localTz, 'h:mm:ss'))
        setPeriodPart(formatInTimeZone(now, localTz, 'a'))
        setCurrentDate(formatInTimeZone(now, localTz, 'MMM d, yyyy'))
      }
      updateTime()
      const interval = setInterval(updateTime, 1000)
      return () => clearInterval(interval)
    }

    const updateTime = () => {
      const now = new Date()
      setTimePart(formatInTimeZone(now, timezoneName, 'h:mm:ss'))
      setPeriodPart(formatInTimeZone(now, timezoneName, 'a'))
      setCurrentDate(formatInTimeZone(now, timezoneName, 'MMM d, yyyy'))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [timezoneName])

  if (!timezoneName) {
    return null
  }

  return (
    <div className="flex flex-col gap-0.5 text-sm bg-black/80 backdrop-blur-sm border border-[#C27E00]/40 rounded-lg px-4 py-3 shadow-lg min-w-[200px]">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[#C27E00] font-semibold text-lg leading-tight tabular-nums">{timePart}</span>
        <span className="text-[#C27E00] font-semibold text-lg leading-tight">{periodPart}</span>
      </div>
      {timezoneDisplayName && (
        <div className="text-[#C27E00]/90 text-xs">({timezoneDisplayName})</div>
      )}
      <div className="text-[#C27E00]/80 text-xs pt-0.5">{currentDate}</div>
    </div>
  )
}

