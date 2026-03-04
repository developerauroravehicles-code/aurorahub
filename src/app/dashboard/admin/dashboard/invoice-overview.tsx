'use client'

import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'
import type { InvoiceSummary } from './actions'

const BAR_COLORS = ['#EAB308', '#F59E0B', '#3B82F6', '#22C55E']

export function InvoiceOverview({ summary }: { summary: InvoiceSummary }) {
  const { waiting, edited, downloaded, drive, incompleteList } = summary
  const total = waiting + edited + downloaded + drive

  const chartData = [
    { name: 'Waiting', value: waiting },
    { name: 'Edited', value: edited },
    { name: 'Downloaded', value: downloaded },
    { name: 'Drive', value: drive }
  ].filter(d => d.value > 0)

  return (
    <div className="bg-white/5 border border-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Invoice Overview</h2>
        <Link
          href="/dashboard/admin/invoices"
          className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
        >
          View All →
        </Link>
      </div>

      {total === 0 ? (
        <p className="text-gray-500 text-sm">No completed demands with invoice data.</p>
      ) : (
        <>
          <div className="h-[120px] mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={70} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Bar dataKey="value" radius={4}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 text-xs mb-3">
            <span className="px-2 py-1 rounded bg-yellow-900/50 text-yellow-300">Waiting: {waiting}</span>
            <span className="px-2 py-1 rounded bg-amber-900/50 text-amber-300">Edited: {edited}</span>
            <span className="px-2 py-1 rounded bg-blue-900/50 text-blue-300">Downloaded: {downloaded}</span>
            <span className="px-2 py-1 rounded bg-green-900/50 text-green-300">Drive: {drive}</span>
          </div>
          {incompleteList.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Incomplete (Drive not uploaded) — {drive}/{total} fully complete:</p>
              <ul className="space-y-1 max-h-[80px] overflow-y-auto">
                {incompleteList.slice(0, 5).map(d => (
                  <li key={d.id}>
                    <Link
                      href={`/dashboard/admin/invoices`}
                      className="text-sm text-gray-300 hover:text-[#C27E00] truncate block"
                    >
                      {d.dealerName} {d.demand_number ? `#${d.demand_number}` : ''}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
