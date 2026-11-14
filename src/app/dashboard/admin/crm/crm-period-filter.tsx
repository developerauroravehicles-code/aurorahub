'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export function CrmPeriodFilter({ year, quarter }: { year: number; quarter: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function update(field: 'year' | 'quarter', value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(field, value)
    router.push(`${pathname}?${params.toString()}`)
  }

  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">Year</label>
        <select
          value={year}
          onChange={(e) => update('year', e.target.value)}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">Period</label>
        <select
          value={quarter}
          onChange={(e) => update('quarter', e.target.value)}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        >
          <option value="1">Q1</option>
          <option value="2">Q2</option>
          <option value="3">Q3</option>
          <option value="4">Q4</option>
          <option value="all">Full year</option>
        </select>
      </div>
    </div>
  )
}