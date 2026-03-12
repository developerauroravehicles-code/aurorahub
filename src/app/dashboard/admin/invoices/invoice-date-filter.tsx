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

interface InvoiceDateFilterProps {
  selectedMonth: string
  startDate: string
  endDate: string
}

export function InvoiceDateFilter({ selectedMonth, startDate, endDate }: InvoiceDateFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    const value = e.target.value
    if (value) {
      params.set('month', value)
      params.delete('startDate')
      params.delete('endDate')
    } else {
      params.delete('month')
      params.delete('startDate')
      params.delete('endDate')
    }
    const q = params.toString()
    router.push(q ? `/dashboard/admin/invoices?${q}` : '/dashboard/admin/invoices')
  }

  const options = getMonthOptions()

  return (
    <div className="flex items-center gap-4">
      <label className="text-sm font-medium text-gray-400">Period:</label>
      <select
        value={selectedMonth}
        onChange={handleMonthChange}
        className="border border-gray-700 bg-white/5 px-3 py-2 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] min-w-[140px]"
      >
        {options.map(o => (
          <option key={o.value || 'all'} value={o.value} className="bg-black text-white">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
