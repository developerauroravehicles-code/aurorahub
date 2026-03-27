'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import {
  formatInvoicePeriodRangeDisplay,
  parseManualInvoicePeriodRange,
} from '@/lib/invoice-period-range-parse'

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  const ptNow = formatInTimeZone(now, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM')
  const [y, m] = ptNow.split('-').map(Number)
  options.push({ value: '', label: 'All time' })
  for (let i = 0; i < 24; i++) {
    const totalMonths = (y - 1) * 12 + (m - 1) - i
    const year = Math.floor(totalMonths / 12) + 1
    const month = ((totalMonths % 12) + 12) % 12 + 1
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
  const [manualDraft, setManualDraft] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedMonth) {
      setManualDraft('')
      setManualError(null)
      return
    }
    if (startDate && endDate) {
      setManualDraft(formatInvoicePeriodRangeDisplay(startDate, endDate, SYSTEM_DEFAULT_TIMEZONE))
      setManualError(null)
    } else {
      setManualDraft('')
      setManualError(null)
    }
  }, [selectedMonth, startDate, endDate])

  const applySearchParams = (params: URLSearchParams) => {
    const q = params.toString()
    router.push(q ? `/dashboard/admin/invoices?${q}` : '/dashboard/admin/invoices')
  }

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
    applySearchParams(params)
  }

  const applyManualRange = () => {
    const parsed = parseManualInvoicePeriodRange(manualDraft, SYSTEM_DEFAULT_TIMEZONE)
    if (!parsed) {
      setManualError('Use e.g. 3 March – 20 March or 3 March 2026 – 20 March 2026 (English months).')
      return
    }
    setManualError(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('month')
    params.set('startDate', parsed.start)
    params.set('endDate', parsed.end)
    applySearchParams(params)
  }

  const options = getMonthOptions()
  const monthLocked = Boolean(selectedMonth)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-400">Period:</label>
        <select
          value={selectedMonth}
          onChange={handleMonthChange}
          className="border border-gray-700 bg-white/5 px-3 py-2 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] min-w-[140px]"
        >
          {options.map((o) => (
            <option key={o.value || 'all'} value={o.value} className="bg-black text-white">
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 min-w-[220px] max-w-xl flex-1">
        <label htmlFor="invoice-manual-period" className="text-xs font-medium text-gray-500">
          Custom range (English dates)
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="invoice-manual-period"
            type="text"
            value={manualDraft}
            onChange={(e) => {
              setManualDraft(e.target.value)
              setManualError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (!monthLocked) applyManualRange()
              }
            }}
            disabled={monthLocked}
            placeholder="e.g. 3 March – 20 March"
            className="flex-1 min-w-[200px] border border-gray-700 bg-white/5 px-3 py-2 rounded text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] disabled:opacity-45 disabled:cursor-not-allowed"
            title={monthLocked ? 'Choose “All time” or a month above to enter a custom range' : undefined}
          />
          <button
            type="button"
            onClick={applyManualRange}
            disabled={monthLocked || !manualDraft.trim()}
            className="shrink-0 border border-[#C27E00]/60 bg-[#C27E00]/20 text-[#C27E00] px-3 py-2 rounded text-sm font-medium hover:bg-[#C27E00]/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
        {manualError && <p className="text-xs text-red-400">{manualError}</p>}
        {monthLocked && (
          <p className="text-xs text-gray-500">Clear the month preset (All time) to use a custom range.</p>
        )}
      </div>
    </div>
  )
}
