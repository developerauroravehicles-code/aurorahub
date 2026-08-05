'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  DemandCustomerHandoffPrint,
  printDemandHandoffSheet,
  type DemandHandoffPrintData,
} from '@/components/demand-customer-handoff-print'

type PrintJob = DemandHandoffPrintData

type DemandPrintContextValue = {
  printDemand: (job: PrintJob) => void
  isPreparing: (demandId: string) => boolean
}

const DemandPrintContext = createContext<DemandPrintContextValue | null>(null)

export function useDemandPrint() {
  const ctx = useContext(DemandPrintContext)
  if (!ctx) {
    throw new Error('useDemandPrint must be used within DemandPrintHost')
  }
  return ctx
}

/** One shared off-screen print sheet for an entire demands list (prevents stacked DOM / PDF drift). */
export function DemandPrintHost({ children }: { children: ReactNode }) {
  const printRef = useRef<HTMLDivElement>(null)
  const [job, setJob] = useState<PrintJob | null>(null)
  const [ready, setReady] = useState(false)
  const [activeDemandId, setActiveDemandId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!job || !ready || !activeDemandId) return

    let cancelled = false

    void (async () => {
      await printDemandHandoffSheet(printRef.current)
      if (!cancelled) {
        setJob(null)
        setReady(false)
        setActiveDemandId(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [job, ready, activeDemandId])

  const printDemand = useCallback((next: PrintJob) => {
    setReady(false)
    setActiveDemandId(next.demand.id)
    setJob(next)
  }, [])

  const isPreparing = useCallback(
    (demandId: string) => activeDemandId === demandId,
    [activeDemandId]
  )

  return (
    <DemandPrintContext.Provider value={{ printDemand, isPreparing }}>
      {children}
      {mounted && job
        ? createPortal(
            <DemandCustomerHandoffPrint
              ref={printRef}
              demand={job.demand}
              dealer={job.dealer}
              timezoneName={job.timezoneName}
              onPrintReadyChange={setReady}
            />,
            document.body
          )
        : null}
    </DemandPrintContext.Provider>
  )
}
