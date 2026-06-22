'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, FilterX, Search } from 'lucide-react'
import { SERVICE_RECORD_DIAGNOSIS_OPTIONS } from '@/lib/customer-service-record-utils'
import {
  hasActiveServiceRecordFilters,
  parseServiceRecordFilters,
  type ServiceRecordFilterState,
} from '@/lib/service-record-filters'

type DealerOption = { id: string; name: string }

type Props = {
  dealers: DealerOption[]
  filters: ServiceRecordFilterState
  totalCount: number
  filteredCount: number
}

const BASE_PATH = '/dashboard/admin/service-records'

function buildParams(current: URLSearchParams, patch: Partial<ServiceRecordFilterState>): URLSearchParams {
  const next = new URLSearchParams(current.toString())

  const setOrDelete = (key: string, value: string | undefined, omitWhen = ['', 'all']) => {
    if (value && !omitWhen.includes(value)) next.set(key, value)
    else next.delete(key)
  }

  setOrDelete('status', patch.status)
  setOrDelete('dealer', patch.dealerId)
  setOrDelete('diagnosis', patch.diagnosis)
  setOrDelete('from', patch.dateFrom)
  setOrDelete('to', patch.dateTo)
  setOrDelete('q', patch.search)

  return next
}

export function ServiceRecordsFilters({ dealers, filters, totalCount, filteredCount }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchDraft, setSearchDraft] = useState(filters.search)

  useEffect(() => {
    setSearchDraft(filters.search)
  }, [filters.search])

  const pushFilters = (patch: Partial<ServiceRecordFilterState>) => {
    const merged: ServiceRecordFilterState = { ...filters, ...patch }
    const params = buildParams(searchParams, merged)
    const q = params.toString()
    router.push(q ? `${BASE_PATH}?${q}` : BASE_PATH)
  }

  const clearAll = () => {
    router.push(BASE_PATH)
  }

  const active = hasActiveServiceRecordFilters(filters)

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-gray-300 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#C27E00]" />
          Filters
        </p>
        <p className="text-xs text-zinc-500 dark:text-gray-500">
          Showing{' '}
          <span className="font-semibold text-zinc-800 dark:text-gray-200">{filteredCount}</span> of{' '}
          {totalCount} record{totalCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div>
          <label htmlFor="sr-dealer" className="block text-xs font-medium text-zinc-500 dark:text-gray-500 mb-1">
            Dealer
          </label>
          <select
            id="sr-dealer"
            value={filters.dealerId}
            onChange={(e) => pushFilters({ dealerId: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
          >
            <option value="all">All dealers</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sr-diagnosis" className="block text-xs font-medium text-zinc-500 dark:text-gray-500 mb-1">
            Issue type
          </label>
          <select
            id="sr-diagnosis"
            value={filters.diagnosis}
            onChange={(e) => pushFilters({ diagnosis: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
          >
            <option value="">All issue types</option>
            {SERVICE_RECORD_DIAGNOSIS_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sr-from" className="block text-xs font-medium text-zinc-500 dark:text-gray-500 mb-1">
            Submitted from
          </label>
          <input
            id="sr-from"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => pushFilters({ dateFrom: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white dark:[color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
          />
        </div>

        <div>
          <label htmlFor="sr-to" className="block text-xs font-medium text-zinc-500 dark:text-gray-500 mb-1">
            Submitted to
          </label>
          <input
            id="sr-to"
            type="date"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(e) => pushFilters({ dateTo: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white dark:[color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
          />
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          pushFilters({ search: searchDraft.trim() })
        }}
      >
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="sr-search" className="block text-xs font-medium text-zinc-500 dark:text-gray-500 mb-1">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              id="sr-search"
              type="text"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Reference, customer, VIN, vehicle, phone…"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[#C27E00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a06900] transition-colors"
        >
          Search
        </button>
        {(searchDraft || filters.search) && (
          <button
            type="button"
            onClick={() => {
              setSearchDraft('')
              pushFilters({ search: '' })
            }}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm text-zinc-600 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Clear search
          </button>
        )}
      </form>

      {active ? (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-gray-400 hover:text-[#C27E00] transition-colors"
        >
          <FilterX className="h-4 w-4" />
          Clear all filters
        </button>
      ) : null}
    </div>
  )
}
