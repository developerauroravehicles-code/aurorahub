'use client'

import { Printer, Loader2 } from 'lucide-react'
import type { DemandHandoffPrintData } from '@/components/demand-customer-handoff-print'
import { useDemandPrint } from '@/components/demand-print-host'

type Props = {
  demand: DemandHandoffPrintData['demand']
  dealer: DemandHandoffPrintData['dealer']
  timezoneName: string | null
  className?: string
  label?: string
}

const DEFAULT_CLASS =
  'inline-flex items-center gap-1.5 rounded-md border border-zinc-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0'

export function DemandPrintButton({ demand, dealer, timezoneName, className, label = 'Print' }: Props) {
  const { printDemand, isPreparing } = useDemandPrint()
  const preparing = isPreparing(demand.id)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    printDemand({ demand, dealer, timezoneName })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={preparing}
      className={className ?? DEFAULT_CLASS}
    >
      {preparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
      {preparing ? 'Preparing…' : label}
    </button>
  )
}
