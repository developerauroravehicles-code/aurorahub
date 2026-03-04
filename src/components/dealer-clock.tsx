'use client'

import { useState, useEffect } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { useSystemTime } from '@/contexts/system-time-context'

interface DealerClockProps {
  timezoneName: string | null
  timezoneDisplayName?: string
}

export function DealerClock({ timezoneName, timezoneDisplayName }: DealerClockProps) {
  const now = useSystemTime()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!timezoneName) {
    return null
  }

  // Render static placeholder on server and during initial hydration to avoid mismatch
  if (!mounted) {
    return (
      <div className="flex flex-col gap-0.5 text-sm bg-black/80 backdrop-blur-sm border border-[#C27E00]/40 rounded-lg px-4 py-3 shadow-lg min-w-[200px]">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[#C27E00] font-semibold text-lg leading-tight tabular-nums">--:--:--</span>
          <span className="text-[#C27E00] font-semibold text-lg leading-tight">--</span>
        </div>
        {timezoneDisplayName && (
          <div className="text-[#C27E00]/90 text-xs">({timezoneDisplayName})</div>
        )}
        <div className="text-[#C27E00]/80 text-xs pt-0.5">--- --, ----</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 text-sm bg-black/80 backdrop-blur-sm border border-[#C27E00]/40 rounded-lg px-4 py-3 shadow-lg min-w-[200px]">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[#C27E00] font-semibold text-lg leading-tight tabular-nums">
          {formatInTimeZone(now, timezoneName, 'h:mm:ss')}
        </span>
        <span className="text-[#C27E00] font-semibold text-lg leading-tight">
          {formatInTimeZone(now, timezoneName, 'a')}
        </span>
      </div>
      {timezoneDisplayName && (
        <div className="text-[#C27E00]/90 text-xs">({timezoneDisplayName})</div>
      )}
      <div className="text-[#C27E00]/80 text-xs pt-0.5">
        {formatInTimeZone(now, timezoneName, 'MMM d, yyyy')}
      </div>
    </div>
  )
}

