import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCrmSnapshot } from '../actions'
import { CrmPeriodFilter } from '../crm-period-filter'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ year?: string; quarter?: string }>

function cad(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export default async function CrmAcquirersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const result = await getCrmSnapshot(sp.year, sp.quarter)
  if (result.error || !result.snapshot) {
    return <p className="text-red-500">{result.error ?? 'Failed to load.'}</p>
  }

  const { snapshot } = result
  const quarterParam =
    snapshot.period.quarter === 'all' ? 'all' : String(snapshot.period.quarter)

  const supabase = await createClient()
  const profileIds = snapshot.acquirer.byAcquirer.map((a) => a.profileId)
  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
    : { data: [] }
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  const dealersByAcquirer = new Map<string, { id: string; name: string }[]>()
  for (const d of snapshot.dealers) {
    if (!d.acquired_by_profile_id) continue
    const list = dealersByAcquirer.get(d.acquired_by_profile_id) ?? []
    list.push({ id: d.id, name: d.name })
    dealersByAcquirer.set(d.acquired_by_profile_id, list)
  }

  return (
    <div className="space-y-6">
      <Suspense>
        <CrmPeriodFilter year={snapshot.period.year} quarter={quarterParam} />
      </Suspense>

      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
        Performance by account acquirer — {snapshot.period.label}
      </h2>

      {snapshot.acquirer.unattributed.salesTotal > 0 || snapshot.acquirer.unattributed.completedCount > 0 ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 p-3">
          Unassigned dealers: {snapshot.acquirer.unattributed.completedCount} installs,{' '}
          {cad(snapshot.acquirer.unattributed.salesTotal)} sales in this period.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-white/5 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3 text-right">Dealers</th>
              <th className="px-4 py-3 text-right">Installs</th>
              <th className="px-4 py-3 text-right">Sales</th>
              <th className="px-4 py-3 text-right">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {snapshot.acquirer.byAcquirer.map((a) => (
              <tr key={a.profileId}>
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900 dark:text-white">
                    {names.get(a.profileId) ?? a.profileId}
                  </div>
                  <ul className="mt-1 text-xs text-zinc-500">
                    {(dealersByAcquirer.get(a.profileId) ?? []).map((d) => (
                      <li key={d.id}>
                        <Link href={`/dashboard/admin/crm/dealers/${d.id}`} className="text-[#C27E00] hover:underline">
                          {d.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{a.dealerCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{a.completedCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{cad(a.salesTotal)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{a.sharePercent.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}