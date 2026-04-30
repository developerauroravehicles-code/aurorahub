'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  const ptNow = formatInTimeZone(now, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM')
  const [y, m] = ptNow.split('-').map(Number)
  options.push({ value: '', label: 'All time' })
  for (let i = 0; i < 24; i++) {
    const totalMonths = (y - 1) * 12 + (m - 1) - i
    const year = Math.floor(totalMonths / 12) + 1
    const month = (totalMonths % 12 + 12) % 12 + 1
    const value = `${year}-${String(month).padStart(2, '0')}`
    const label = formatInTimeZone(new Date(year, month - 1, 15), SYSTEM_DEFAULT_TIMEZONE, 'MMM yyyy')
    options.push({ value, label })
  }
  return options
}

interface FinanceOverviewMonthSelectorProps {
  selectedMonth: string
}

export function FinanceOverviewMonthSelector({ selectedMonth }: FinanceOverviewMonthSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    const value = e.target.value
    if (value) {
      params.set('financeMonth', value)
    } else {
      params.delete('financeMonth')
    }
    const q = params.toString()
    router.push(q ? `/dashboard?${q}#finance-overview` : '/dashboard#finance-overview')
  }

  const options = getMonthOptions()

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-zinc-600 dark:text-zinc-300">Period:</label>
      <select
        value={selectedMonth}
        onChange={handleMonthChange}
        className="min-w-[120px] rounded border border-zinc-300 bg-zinc-100 px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] dark:border-gray-600 dark:bg-zinc-900 dark:text-zinc-100 dark:[color-scheme:dark]"
      >
        {options.map(o => (
          <option
            key={o.value || 'all'}
            value={o.value}
            className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
