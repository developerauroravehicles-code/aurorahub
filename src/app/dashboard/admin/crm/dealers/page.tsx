import Link from 'next/link'
import { Suspense } from 'react'
import { getCrmSnapshot } from '../actions'
import { CrmPeriodFilter } from '../crm-period-filter'
import { salesStatForDealer } from '@/lib/crm/load-crm-data'
import { regionCodeLabel } from '@/lib/crm/region-label'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ year?: string; quarter?: string; q?: string }>

function cad(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export default async function CrmDealersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const result = await getCrmSnapshot(sp.year, sp.quarter)
  if (result.error || !result.snapshot) {
    return <p className="text-red-500">{result.error ?? 'Failed to load.'}</p>
  }

  const { snapshot } = result
  const quarterParam =
    snapshot.period.quarter === 'all' ? 'all' : String(snapshot.period.quarter)
  const search = (sp.q ?? '').trim().toLowerCase()

  const rows = snapshot.dealers
    .filter((d) => {
      if (!search) return true
      return (
        d.name.toLowerCase().includes(search) ||
        d.code.toLowerCase().includes(search) ||
        (regionCodeLabel(d.region_codes) ?? '').toLowerCase().includes(search)
      )
    })
    .map((d) => {
      const stat = salesStatForDealer(d.id, snapshot.sales.byDealer)
      return { d, stat }
    })

  return (
    <div className="space-y-6">
      <Suspense>
        <CrmPeriodFilter year={snapshot.period.year} quarter={quarterParam} />
      </Suspense>

      <form className="max-w-md">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Search dealers…"
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm"
        />
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-white/5 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Dealer</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Acquired by</th>
              <th className="px-4 py-3 text-right">Installs</th>
              <th className="px-4 py-3 text-right">Sales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map(({ d, stat }) => (
              <tr key={d.id} className="hover:bg-zinc-50/80 dark:hover:bg-white/5">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/admin/crm/dealers/${d.id}`} className="font-medium text-[#C27E00] hover:underline">
                    {d.name}
                  </Link>
                  <div className="text-xs text-zinc-400">{d.code}</div>
                </td>
                <td className="px-4 py-3">{regionCodeLabel(d.region_codes) ?? '—'}</td>
                <td className="px-4 py-3">{d.phone ?? '—'}</td>
                <td className="px-4 py-3">{d.acquired_by?.full_name ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{stat.completedCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{cad(stat.salesTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}