import { Suspense } from 'react'
import { getCrmSnapshot } from '../actions'
import { CrmPeriodFilter } from '../crm-period-filter'
import { DealerPerformanceTable, type PerformanceRow } from '../dealer-performance-table'
import { salesStatForDealer } from '@/lib/crm/load-crm-data'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ year?: string; quarter?: string }>

export default async function CrmPerformancePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const result = await getCrmSnapshot(sp.year, sp.quarter)
  if (result.error || !result.snapshot) {
    return <p className="text-red-500">{result.error ?? 'Failed to load.'}</p>
  }

  const { snapshot } = result
  const quarterParam =
    snapshot.period.quarter === 'all' ? 'all' : String(snapshot.period.quarter)

  const rows: PerformanceRow[] = snapshot.dealers
    .map((d) => {
      const stat = salesStatForDealer(d.id, snapshot.sales.byDealer)
      return {
        dealerId: d.id,
        dealerName: d.name,
        dealerCode: d.code,
        completedCount: stat.completedCount,
        salesTotal: stat.salesTotal,
        sharePercent: stat.sharePercent,
        acquiredByName: d.acquired_by?.full_name ?? null,
      }
    })
    .sort((a, b) => b.salesTotal - a.salesTotal)

  return (
    <div className="space-y-6">
      <Suspense>
        <CrmPeriodFilter year={snapshot.period.year} quarter={quarterParam} />
      </Suspense>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Dealer comparison — {snapshot.period.label}</h2>
      <DealerPerformanceTable rows={rows} />
    </div>
  )
}