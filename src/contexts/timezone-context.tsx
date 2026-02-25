'use client'

import { createContext, useContext } from 'react'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

/** System timezone (Pacific) - used for calendar, past checks, SMS. Dealer TZ only for display. */
const TimezoneContext = createContext<string>(SYSTEM_DEFAULT_TIMEZONE)

export function TimezoneProvider({
  children,
  timezoneName,
}: {
  children: React.ReactNode
  timezoneName: string | null
}) {
  return (
    <TimezoneContext.Provider value={timezoneName ?? SYSTEM_DEFAULT_TIMEZONE}>
      {children}
    </TimezoneContext.Provider>
  )
}

export function useTimezone() {
  return useContext(TimezoneContext)
}
