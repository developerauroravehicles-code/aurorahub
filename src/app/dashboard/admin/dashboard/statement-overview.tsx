'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import type { StatementSummary } from './actions'

export function StatementOverview({ summary }: { summary: StatementSummary }) {
  const { dealersWithRecentCompleted, totalCompletedLast30Days } = summary

  return (
    <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#C27E00]" />
          Statement Overview
        </h2>
        <Link
          href="/dashboard/admin/statements"
          className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
        >
          Generate →
        </Link>
      </div>

      <div className="space-y-3">
        <div className="p-3 rounded-lg border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-black/20">
          <p className="text-sm text-zinc-500 dark:text-gray-400">Dealers with completed demands (last 30 days)</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{dealersWithRecentCompleted}</p>
        </div>
        <div className="p-3 rounded-lg border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-black/20">
          <p className="text-sm text-zinc-500 dark:text-gray-400">Completed demands (last 30 days)</p>
          <p className="text-2xl font-bold text-[#C27E00]">{totalCompletedLast30Days}</p>
        </div>
      </div>
      <p className="text-xs text-zinc-500 dark:text-gray-500 mt-3">
        Filter by dealer and date range on Statements page to generate PDFs.
      </p>
    </div>
  )
}
