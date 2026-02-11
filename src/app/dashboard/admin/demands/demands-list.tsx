'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone } from '@/lib/timezone-defaults'
import { Filter, X } from 'lucide-react'
import Link from 'next/link'

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
  dealers?: { name: string; region_codes?: { timezones?: { name: string } } } | null
  profiles?: { full_name: string } | null
}

function getDealerTz(dealers: Demand['dealers']): string | null {
  return dealers?.region_codes?.timezones?.name ?? null
}

interface DemandsListProps {
  demands: Demand[]
}

export function DemandsList({ demands }: DemandsListProps) {
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

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      
      if (dateFilter === 'today') {
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        filtered = filtered.filter(d => {
          const appointmentDate = new Date(d.appointment_date)
          return appointmentDate >= today && appointmentDate < tomorrow
        })
      } else if (dateFilter === 'this_week') {
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 7)
        filtered = filtered.filter(d => {
          const appointmentDate = new Date(d.appointment_date)
          return appointmentDate >= weekStart && appointmentDate < weekEnd
        })
      } else if (dateFilter === 'this_month') {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1)
        filtered = filtered.filter(d => {
          const appointmentDate = new Date(d.appointment_date)
          return appointmentDate >= monthStart && appointmentDate < monthEnd
        })
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(d => 
        `${d.customer_firstname} ${d.customer_lastname}`.toLowerCase().includes(query) ||
        `${d.vehicle_year} ${d.vehicle_make} ${d.vehicle_model}`.toLowerCase().includes(query) ||
        (d.dealers && (d.dealers as any)?.name?.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [demands, statusFilter, dateFilter, searchQuery])

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
                placeholder="Customer, vehicle, or dealer..."
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
        {filteredDemands.length === 0 ? (
          <p className="p-4 text-gray-400 text-center">
            {hasActiveFilters ? 'No demands match your filters.' : 'No demands found.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {filteredDemands.map(demand => {
              const statusColors = {
                pending_finance: 'bg-yellow-500/20 text-yellow-400',
                approved: 'bg-blue-500/20 text-blue-400',
                completed: 'bg-green-500/20 text-green-400',
                cancelled: 'bg-red-500/20 text-red-400'
              }

              return (
                <li key={demand.id} className="p-4 hover:bg-white/5 transition-colors">
                  <Link href={`/dashboard/admin/demands/${demand.id}`} className="block">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-lg font-medium text-[#C27E00] hover:text-[#a06900] transition-colors">
                          {demand.customer_firstname} {demand.customer_lastname}
                        </p>
                        <p className="text-sm text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                        <p className="text-sm text-gray-500">
                          Appointment: {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(getDealerTz(demand.dealers) ?? null), 'PPP p')}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Dealer: {(demand.dealers as any)?.name || 'Unknown'} | Created by: {(demand.profiles as any)?.full_name || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                          statusColors[demand.status as keyof typeof statusColors] || 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {demand.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

