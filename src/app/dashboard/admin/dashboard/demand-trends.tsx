'use client'

import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from 'recharts'
import type { MonthlyDemandTrend, DealerDemandCount } from './actions'

export function DemandTrends({ monthlyTrend, dealerDemands }: { monthlyTrend: MonthlyDemandTrend; dealerDemands: DealerDemandCount }) {
  return (
    <div className="bg-zinc-200/50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Demand Analytics</h2>
        <Link href="/dashboard/admin/demands" className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors">
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-gray-300 mb-3">Monthly Trend (Last 6 Months)</h3>
          {monthlyTrend.length === 0 ? (
            <p className="text-zinc-600 dark:text-gray-500 text-sm py-8">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyTrend} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#52525b" opacity={0.45} />
                <XAxis dataKey="month" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number | undefined) => [value ?? 0, '']}
                  labelFormatter={(label) => label}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#e4e4e7' }} formatter={(v) => <span className="text-zinc-700 dark:text-zinc-300">{v}</span>} />
                <Bar dataKey="demands" name="Total" fill="#3B82F6" radius={4} />
                <Bar dataKey="completed" name="Completed" fill="#22C55E" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Dealer Comparison */}
        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-gray-300 mb-3">Top Dealers by Demand Count</h3>
          {dealerDemands.length === 0 ? (
            <p className="text-zinc-600 dark:text-gray-500 text-sm py-8">No dealer data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dealerDemands} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#52525b" opacity={0.45} />
                <XAxis type="number" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <YAxis type="category" dataKey="dealerName" width={100} tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(value: number | undefined) => [value ?? 0, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#e4e4e7' }} formatter={(v) => <span className="text-zinc-700 dark:text-zinc-300">{v}</span>} />
                <Bar dataKey="total" name="Total" fill="#C27E00" radius={4} />
                <Bar dataKey="completed" name="Completed" fill="#22C55E" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
