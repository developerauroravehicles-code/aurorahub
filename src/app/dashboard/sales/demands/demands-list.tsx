'use client'

import { useState, useMemo } from 'react'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { getEffectiveTimezone, getTodayRangeInTimezone } from '@/lib/timezone-defaults'
import { Filter, X } from 'lucide-react'
import { demandMatchesSmartSearch } from '@/lib/demand-smart-search'

interface Demand {
  id: string
  demand_number?: number | string
  status: string
  created_at: string
  customer_firstname: string
  customer_lastname: string
  customer_phone?: string | null
  vin_last6?: string | null
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  stock_number?: string | null
  appointment_date: string
  comment?: string | null
}

interface DemandsListProps {
  demands: Demand[]
  timezoneName?: string | null
  duplicateStockNumbers?: string[]
}

export function DemandsList({ demands, timezoneName = null, duplicateStockNumbers = [] }: DemandsListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [searchValue, setSearchValue] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  const filteredDemands = useMemo(() => {
    let filtered = [...demands]

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter)
    }

    // Date filter (PST / dealer timezone - no server local)
    if (dateFilter !== 'all') {
      const tz = getEffectiveTimezone(timezoneName ?? null)
      const { start: todayStart, end: todayEnd } = getTodayRangeInTimezone(tz)
      const todayStartMs = new Date(todayStart).getTime()
      const todayEndMs = new Date(todayEnd).getTime()

      if (dateFilter === 'today') {
        filtered = filtered.filter(d => {
          const t = new Date(d.appointment_date).getTime()
          return t >= todayStartMs && t <= todayEndMs
        })
      } else if (dateFilter === 'this_week') {
        const dateStr = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')
        const [y, mo, d] = dateStr.split('-').map(Number)
        const dateInTz = new Date(y, mo - 1, d)
        const dayOfWeek = dateInTz.getDay()
        const weekStartDate = new Date(dateInTz)
        weekStartDate.setDate(dateInTz.getDate() - dayOfWeek)
        const weekEndDate = new Date(weekStartDate)
        weekEndDate.setDate(weekStartDate.getDate() + 7)
        const weekStartMs = fromZonedTime(weekStartDate, tz).getTime()
        const weekEndMs = fromZonedTime(weekEndDate, tz).getTime()
        filtered = filtered.filter(d => {
          const t = new Date(d.appointment_date).getTime()
          return t >= weekStartMs && t < weekEndMs
        })
      } else if (dateFilter === 'this_month') {
        const dateStr = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')
        const [y, mo] = dateStr.split('-').map(Number)
        const monthStartDate = new Date(y, mo - 1, 1)
        const monthEndDate = new Date(y, mo, 1)
        const monthStartMs = fromZonedTime(monthStartDate, tz).getTime()
        const monthEndMs = fromZonedTime(monthEndDate, tz).getTime()
        filtered = filtered.filter(d => {
          const t = new Date(d.appointment_date).getTime()
          return t >= monthStartMs && t < monthEndMs
        })
      }
    }

    if (searchValue.trim()) {
      filtered = filtered.filter(d => demandMatchesSmartSearch(d, searchValue))
    }

    return filtered
  }, [demands, statusFilter, dateFilter, searchValue, timezoneName])

  const hasActiveFilters = statusFilter !== 'all' || dateFilter !== 'all' || searchValue.trim() !== ''

  const clearFilters = () => {
    setStatusFilter('all')
    setDateFilter('all')
    setSearchValue('')
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm text-zinc-600 dark:text-gray-300 hover:text-zinc-900 dark:text-white transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 px-2 py-0.5 bg-[#C27E00] text-white text-xs rounded-full">
                Active
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">Search</label>
              <input
                type="search"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Name, phone, VIN, stock, or demand # — auto-detected"
                autoComplete="off"
                className="w-full border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 rounded text-zinc-900 dark:text-white text-sm placeholder:text-zinc-500 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-gray-500">
                Matches customer name, phone, VIN (last 6), stock number, or demand reference (OR).
              </p>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 rounded text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
              >
                <option value="all" className="bg-zinc-50 dark:bg-black">All Status</option>
                <option value="pending_finance" className="bg-zinc-50 dark:bg-black">Pending Finance</option>
                <option value="approved" className="bg-zinc-50 dark:bg-black">Approved</option>
                <option value="completed" className="bg-zinc-50 dark:bg-black">Completed</option>
                <option value="cancelled" className="bg-zinc-50 dark:bg-black">Cancelled</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">Date Range</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 rounded text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
              >
                <option value="all" className="bg-zinc-50 dark:bg-black">All Time</option>
                <option value="today" className="bg-zinc-50 dark:bg-black">Today</option>
                <option value="this_week" className="bg-zinc-50 dark:bg-black">This Week</option>
                <option value="this_month" className="bg-zinc-50 dark:bg-black">This Month</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="text-sm text-zinc-500 dark:text-gray-400">
        Showing {filteredDemands.length} of {demands.length} demands
      </div>

      {/* Demands List */}
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 shadow overflow-hidden">
        <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
          {filteredDemands.length === 0 ? (
            <li className="p-8 text-center text-zinc-500 dark:text-gray-400">
              {hasActiveFilters ? 'No demands match your filters.' : 'No demands found.'}
            </li>
          ) : (
            filteredDemands.map((demand) => {
              const statusColors = {
                pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                completed: 'bg-green-900/50 text-green-300 border-green-800',
                cancelled: 'bg-red-900/50 text-red-300 border-red-800'
              }

              return (
                <li key={demand.id} className="hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#C27E00] truncate">
                          {demand.customer_firstname} {demand.customer_lastname}
                        </p>
                        {demand.demand_number != null && (
                          <span className="text-xs text-zinc-500 dark:text-gray-500">#{demand.demand_number}</span>
                        )}
                        {demand.stock_number && duplicateStockNumbers.includes((demand.stock_number as string).trim().toUpperCase()) && (
                          <span className="text-xs text-amber-400">(Duplicate Stock No)</span>
                        )}
                      </div>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                          statusColors[demand.status as keyof typeof statusColors] || 'bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-gray-300 border-zinc-300 dark:border-gray-700'
                        }`}>
                          {demand.status.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-zinc-500 dark:text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-zinc-500 dark:text-gray-400 sm:mt-0">
                        <p>
                          Appointment: {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(timezoneName ?? null), 'PPP h:mm a')}
                        </p>
                      </div>
                    </div>
                    {demand.comment && (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-gray-400 italic">Comment: {demand.comment}</p>
                    )}
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}

