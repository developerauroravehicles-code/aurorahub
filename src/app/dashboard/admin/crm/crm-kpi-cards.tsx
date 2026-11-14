type Props = {
  periodLabel: string
  globalSalesTotal: number
  globalCompletedCount: number
  activeDealers: number
  totalRegisteredDealers: number
}

function cad(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export function CrmKpiCards({
  periodLabel,
  globalSalesTotal,
  globalCompletedCount,
  activeDealers,
  totalRegisteredDealers,
}: Props) {
  const cards = [
    { label: 'Total sales (invoiced)', value: cad(globalSalesTotal), sub: periodLabel },
    { label: 'Completed installations', value: String(globalCompletedCount), sub: periodLabel },
    { label: 'Active dealers', value: String(activeDealers), sub: '≥1 completion in period' },
    { label: 'Registered dealers', value: String(totalRegisteredDealers), sub: 'All dealers' },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-gray-400">{c.label}</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white tabular-nums">{c.value}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-gray-500">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}