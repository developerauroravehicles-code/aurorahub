'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const SystemTimeContext = createContext<Date>(new Date())

/**
 * Provides system "now" - shared between DealerClock and AppointmentCalendar.
 * Both must use the SAME moment for consistency.
 */
export function SystemTimeProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  return (
    <SystemTimeContext.Provider value={now}>
      {children}
    </SystemTimeContext.Provider>
  )
}

export function useSystemTime() {
  return useContext(SystemTimeContext)
}
