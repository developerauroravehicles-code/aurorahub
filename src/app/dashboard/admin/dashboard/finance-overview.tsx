'use client'

import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from 'recharts'
import { DollarSign, TrendingUp } from 'lucide-react'
import { FinanceOverviewMonthSelector } from './finance-overview-month-selector'
import type { FinanceSummary } from './actions'

const fmt = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function FinanceOverview({ summary, selectedMonth = '' }: { summary: FinanceSummary; selectedMonth?: string }) {
  const { totalInvoiced, totalTax, totalSubtotal, invoiceCount, byDealer } = summary

  const chartData = byDealer.slice(0, 8).map(d => ({
    name: d.dealerName.length > 15 ? d.dealerName.slice(0, 15) + '…' : d.dealerName,
    fullName: d.dealerName,
    total: Math.round(d.total * 100) / 100,
    tax: Math.round(d.tax * 100) / 100,
    count: d.count
  }))

  return (
    <div className="bg-zinc-200/50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-500" />
          Finance Overview
        </h2>
        <div className="flex items-center gap-3">
          <FinanceOverviewMonthSelector selectedMonth={selectedMonth} />
          <Link href="/dashboard/admin/invoices" className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors">
            View Invoices →
          </Link>
        </div>
      </div>

      {invoiceCount === 0 ? (
        <p className="text-zinc-600 dark:text-gray-500 text-sm">No invoice data yet. Complete demands and add invoice amounts.</p>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-zinc-900/50">
              <p className="text-xs text-zinc-600 dark:text-gray-400 mb-1">Total Invoiced</p>
              <p className="text-xl font-bold text-[#C27E00]">{fmt(totalInvoiced)}</p>
            </div>
            <div className="p-3 rounded-lg border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-zinc-900/50">
              <p className="text-xs text-zinc-600 dark:text-gray-400 mb-1">Subtotal</p>
              <p className="text-lg font-bold text-zinc-900 dark:text-white">{fmt(totalSubtotal)}</p>
            </div>
            <div className="p-3 rounded-lg border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-zinc-900/50">
              <p className="text-xs text-zinc-600 dark:text-gray-400 mb-1">Tax (GST/PST)</p>
              <p className="text-lg font-bold text-blue-400">{fmt(totalTax)}</p>
            </div>
            <div className="p-3 rounded-lg border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-zinc-900/50">
              <p className="text-xs text-zinc-600 dark:text-gray-400 mb-1">Invoice Count</p>
              <p className="text-lg font-bold text-green-400">{invoiceCount}</p>
            </div>
          </div>

          {/* Dealer Breakdown Chart */}
          {chartData.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-700 dark:text-gray-300 mb-3 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Invoice Totals by Dealer
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#52525b" opacity={0.45} />
                  <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    formatter={(value: number | undefined) => [typeof value === 'number' ? fmt(value) : String(value ?? ''), '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#e4e4e7' }} formatter={(v) => <span className="text-zinc-700 dark:text-zinc-300">{v}</span>} />
                  <Bar dataKey="total" name="Total" fill="#C27E00" radius={4} />
                  <Bar dataKey="tax" name="Tax" fill="#3B82F6" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Dealer Table (compact) */}
          {byDealer.length > 0 && (
            <div className="mt-4 border-t border-zinc-300 dark:border-gray-700 pt-3">
              <p className="text-xs text-zinc-600 dark:text-gray-500 mb-2">Dealer breakdown</p>
              <div className="max-h-[120px] overflow-y-auto space-y-1">
                {byDealer.slice(0, 6).map(d => (
                  <div key={d.dealerName} className="flex justify-between items-center text-sm py-1 border-b border-zinc-200 dark:border-gray-800 last:border-0">
                    <span className="text-zinc-700 dark:text-gray-300 truncate flex-1">{d.dealerName}</span>
                    <span className="text-[#C27E00] font-medium shrink-0 ml-2">{fmt(d.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
