'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { getEffectiveTimezone, getTodayRangeInTimezone } from '@/lib/timezone-defaults'
import { Filter, X } from 'lucide-react'

interface Demand {
  id: string
  status: string
  created_at: string
  customer_firstname: string
  customer_lastname: string
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  appointment_date: string
}

interface DemandsListProps {
  demands: Demand[]
  timezoneName?: string | null
}

export function DemandsList({ demands, timezoneName = null }: DemandsListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
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

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(d => 
        `${d.customer_firstname} ${d.customer_lastname}`.toLowerCase().includes(query) ||
        `${d.vehicle_year} ${d.vehicle_make} ${d.vehicle_model}`.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [demands, statusFilter, dateFilter, searchQuery, timezoneName])

  const hasActiveFilters = statusFilter !== 'all' || dateFilter !== 'all' || searchQuery.trim() !== ''

  const clearFilters = () => {
    setStatusFilter('all')
    setDateFilter('all')
    setSearchQuery('')
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white/5 rounded-lg border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
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
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Customer name or vehicle..."
                className="w-full border border-gray-700 bg-white/5 p-2 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-700 bg-white/5 p-2 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
              >
                <option value="all" className="bg-black">All Status</option>
                <option value="pending_finance" className="bg-black">Pending Finance</option>
                <option value="approved" className="bg-black">Approved</option>
                <option value="completed" className="bg-black">Completed</option>
                <option value="cancelled" className="bg-black">Cancelled</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Date Range</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full border border-gray-700 bg-white/5 p-2 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
              >
                <option value="all" className="bg-black">All Time</option>
                <option value="today" className="bg-black">Today</option>
                <option value="this_week" className="bg-black">This Week</option>
                <option value="this_month" className="bg-black">This Month</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-400">
        Showing {filteredDemands.length} of {demands.length} demands
      </div>

      {/* Demands List */}
      <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
        <ul className="divide-y divide-gray-800">
          {filteredDemands.length === 0 ? (
            <li className="p-8 text-center text-gray-400">
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
                <li key={demand.id} className="hover:bg-white/5 transition-colors">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#C27E00] truncate">
                        {demand.customer_firstname} {demand.customer_lastname}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                          statusColors[demand.status as keyof typeof statusColors] || 'bg-white/10 text-gray-300 border-gray-700'
                        }`}>
                          {demand.status.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-400 sm:mt-0">
                        <p>
                          Appointment: {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(timezoneName ?? null), 'PPP h:mm a')}
                        </p>
                      </div>
                    </div>
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

