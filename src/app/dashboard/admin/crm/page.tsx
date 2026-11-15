import { Suspense } from 'react'
import { getCrmSnapshot } from './actions'
import { CrmPeriodFilter } from './crm-period-filter'
import { CrmKpiCards } from './crm-kpi-cards'
import { DealerPerformanceTable, type PerformanceRow } from './dealer-performance-table'
import { salesStatForDealer } from '@/lib/crm/load-crm-data'
import Link from 'next/link'
import { NewProspectForm } from './new-prospect-form'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ year?: string; quarter?: string }>

export default async function CrmOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const result = await getCrmSnapshot(sp.year, sp.quarter)
  if (result.error || !result.snapshot) {
    return <p className="text-red-500">{result.error ?? 'Failed to load CRM.'}</p>
  }

  const { snapshot } = result
  const quarterParam =
    snapshot.period.quarter === 'all' ? 'all' : String(snapshot.period.quarter)

  const perfRows: PerformanceRow[] = snapshot.dealers
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
    .filter((r) => r.completedCount > 0 || r.salesTotal > 0)
    .sort((a, b) => b.salesTotal - a.salesTotal)
    .slice(0, 10)

  return (
    <div className="space-y-8">
      <Suspense>
        <CrmPeriodFilter year={snapshot.period.year} quarter={quarterParam} />
      </Suspense>

      <CrmKpiCards
        periodLabel={snapshot.period.label}
        globalSalesTotal={snapshot.sales.globalSalesTotal}
        globalCompletedCount={snapshot.sales.globalCompletedCount}
        activeDealers={snapshot.activeDealers}
        totalRegisteredDealers={snapshot.totalRegisteredDealers}
      />

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">New conversations</h2>
            <p className="text-sm text-zinc-500">
              Start a potential dealer record without creating a dealer in Configuration.
            </p>
          </div>
          <Link
            href="/dashboard/admin/crm/prospects"
            className="text-sm text-[#C27E00] hover:underline"
          >
            All prospects →
          </Link>
        </div>
        <NewProspectForm compact />
      </section>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Top dealers</h2>
        <DealerPerformanceTable rows={perfRows} />
      </div>
    </div>
  )
}