'use client'

import { useEffect, useRef, useState } from 'react'
import { Printer, Loader2 } from 'lucide-react'
import {
  DemandCustomerHandoffPrint,
  printDemandHandoffSheet,
  type DemandHandoffPrintData,
} from '@/components/demand-customer-handoff-print'

type Props = {
  demand: DemandHandoffPrintData['demand']
  dealer: DemandHandoffPrintData['dealer']
  timezoneName: string | null
  className?: string
  label?: string
}

const DEFAULT_CLASS =
  'inline-flex items-center gap-1.5 rounded-md border border-zinc-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0'

/** Renders a "Print" button that lazily builds the customer handoff sheet (with QR codes) on first click. */
export function DemandPrintButton({ demand, dealer, timezoneName, className, label = 'Print' }: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [ready, setReady] = useState(false)
  const [pendingPrint, setPendingPrint] = useState(false)

  useEffect(() => {
    if (mounted && ready && pendingPrint) {
      setPendingPrint(false)
      void printDemandHandoffSheet(printRef.current)
    }
  }, [mounted, ready, pendingPrint])

  function handleClick() {
    if (ready) {
      void printDemandHandoffSheet(printRef.current)
      return
    }
    setPendingPrint(true)
    setMounted(true)
  }

  const preparing = mounted && !ready

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={preparing}
        className={className ?? DEFAULT_CLASS}
      >
        {preparing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Printer className="h-3.5 w-3.5" />
        )}
        {preparing ? 'Preparing…' : label}
      </button>
      {mounted ? (
        <DemandCustomerHandoffPrint
          ref={printRef}
          demand={demand}
          dealer={dealer}
          timezoneName={timezoneName}
          onPrintReadyChange={setReady}
        />
      ) : null}
    </>
  )
}
