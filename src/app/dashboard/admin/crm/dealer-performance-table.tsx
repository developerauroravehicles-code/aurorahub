import Link from 'next/link'

export type PerformanceRow = {
  dealerId: string
  dealerName: string
  dealerCode: string
  completedCount: number
  salesTotal: number
  sharePercent: number
  acquiredByName?: string | null
}

function cad(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export function DealerPerformanceTable({ rows }: { rows: PerformanceRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-gray-400">No completed jobs in this period.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
        <thead className="bg-zinc-50 dark:bg-white/5 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3">Dealer</th>
            <th className="px-4 py-3 text-right">Installs</th>
            <th className="px-4 py-3 text-right">Sales</th>
            <th className="px-4 py-3 text-right">Share</th>
            <th className="px-4 py-3">Acquired by</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((r) => (
            <tr key={r.dealerId} className="hover:bg-zinc-50/80 dark:hover:bg-white/5">
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/admin/crm/dealers/${r.dealerId}`}
                  className="font-medium text-[#C27E00] hover:underline"
                >
                  {r.dealerName}
                </Link>
                <span className="ml-2 text-xs text-zinc-400">{r.dealerCode}</span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{r.completedCount}</td>
              <td className="px-4 py-3 text-right tabular-nums">{cad(r.salesTotal)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.sharePercent.toFixed(1)}%</td>
              <td className="px-4 py-3 text-zinc-600 dark:text-gray-300">{r.acquiredByName ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}