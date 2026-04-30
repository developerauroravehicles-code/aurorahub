'use client'

import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { DemandCounts } from './actions'

const COLORS = ['#EAB308', '#3B82F6', '#22C55E', '#EF4444']

export function DemandOverview({
  counts,
  recentDemands
}: {
  counts: DemandCounts
  recentDemands: { id: string; demand_number?: number; customer_firstname: string; customer_lastname: string; status: string }[]
}) {
  const data = [
    { name: 'Pending Finance', value: counts.pending_finance, color: COLORS[0] },
    { name: 'Approved', value: counts.approved, color: COLORS[1] },
    { name: 'Completed', value: counts.completed, color: COLORS[2] },
    { name: 'Cancelled', value: counts.cancelled, color: COLORS[3] }
  ].filter(d => d.value > 0)

  const total = counts.pending_finance + counts.approved + counts.completed + counts.cancelled

  return (
    <div className="bg-zinc-200/50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Demand Overview</h2>
        <Link
          href="/dashboard/admin/demands"
          className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="min-h-[200px]">
          {total === 0 ? (
            <p className="text-zinc-600 dark:text-gray-500 text-sm py-8">No demands yet.</p>
          ) : data.length === 0 ? (
            <p className="text-zinc-600 dark:text-gray-500 text-sm py-8">No data to display.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | undefined) => [`${value ?? 0} (${total > 0 && value != null ? Math.round((value / total) * 100) : 0}%)`, '']}
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  formatter={(value) => <span className="text-zinc-700 dark:text-zinc-300">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-gray-300 mb-2">Recent Demands</h3>
          {recentDemands.length === 0 ? (
            <p className="text-zinc-600 dark:text-gray-500 text-sm">No recent demands.</p>
          ) : (
            <ul className="space-y-2 max-h-[180px] overflow-y-auto">
              {recentDemands.slice(0, 5).map(d => {
                const statusColors: Record<string, string> = {
                  pending_finance: 'bg-yellow-900/50 text-yellow-300',
                  approved: 'bg-blue-900/50 text-blue-300',
                  completed: 'bg-green-900/50 text-green-300',
                  cancelled: 'bg-red-900/50 text-red-300'
                }
                return (
                  <li key={d.id}>
                    <Link
                      href={`/dashboard/admin/demands/${d.id}`}
                      className="flex items-center gap-2 p-2 rounded-lg border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-zinc-900/45 hover:bg-zinc-100/90 dark:hover:bg-zinc-900/70 transition-colors"
                    >
                      <span className="text-sm font-medium text-zinc-900 dark:text-white truncate flex-1">
                        {d.customer_firstname} {d.customer_lastname}
                        {d.demand_number != null && (
                          <span className="text-zinc-500 dark:text-gray-500 text-xs ml-1">#{d.demand_number}</span>
                        )}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColors[d.status] ?? 'bg-gray-800 text-zinc-500 dark:text-gray-400'}`}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
