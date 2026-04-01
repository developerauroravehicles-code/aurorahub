'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone } from '@/lib/timezone-defaults'
import { Filter, X } from 'lucide-react'
import { DemandActions } from './demand-actions'

type DealerRow = { name: string; region_codes?: { timezones?: { name: string } } } | null

interface Demand {
  id: string
  demand_number?: number | string
  status: string
  created_at: string
  dealer_id?: string | null
  customer_firstname: string
  customer_lastname: string
  customer_phone: string
  customer_address: string | null
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  stock_number: string | null
  camera_model: string
  appointment_date: string
  assigned_specialist_id?: string | null
  comment?: string | null
  dealers?: DealerRow | DealerRow[] | null
  profiles?: { full_name: string } | null
}

function getDealerTimezone(dealers: Demand['dealers']): string | null {
  if (!dealers) return null
  const d = Array.isArray(dealers) ? dealers[0] : dealers
  return (d as DealerRow)?.region_codes?.timezones?.name ?? null
}

function formatAppointment(appointmentDate: string, dealers: Demand['dealers']): string {
  const tz = getDealerTimezone(dealers)
  return formatInTimeZone(new Date(appointmentDate), getEffectiveTimezone(tz ?? null), 'PPP h:mm a')
}

interface FinanceDemandsListProps {
  myAssignedDemands: Demand[]
  unassignedDemands: Demand[]
  allAssignedDemands: Demand[]
  completedDemands?: Demand[]
  duplicateStockNumbers?: string[]
}

export function FinanceDemandsList({ myAssignedDemands, unassignedDemands, allAssignedDemands, completedDemands = [], duplicateStockNumbers = [] }: FinanceDemandsListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [searchType, setSearchType] = useState<'customer' | 'demand_id'>('customer')
  const [searchValue, setSearchValue] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  const filterDemands = (demands: Demand[]) => {
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

    // Search filter (by selected criterion only)
    if (searchValue.trim()) {
      const query = searchValue.toLowerCase().trim()
      if (searchType === 'customer') {
        filtered = filtered.filter(d =>
          `${d.customer_firstname} ${d.customer_lastname}`.toLowerCase().includes(query)
        )
      } else {
        filtered = filtered.filter(d =>
          d.demand_number != null && String(d.demand_number).toLowerCase().includes(query)
        )
      }
    }

    return filtered
  }

  const filteredMyAssigned = useMemo(() => filterDemands(myAssignedDemands), [myAssignedDemands, statusFilter, dateFilter, searchType, searchValue])
  const filteredUnassigned = useMemo(() => filterDemands(unassignedDemands), [unassignedDemands, statusFilter, dateFilter, searchType, searchValue])
  const filteredAllAssigned = useMemo(() => filterDemands(allAssignedDemands), [allAssignedDemands, statusFilter, dateFilter, searchType, searchValue])
  const filteredCompleted = useMemo(() => filterDemands(completedDemands), [completedDemands, statusFilter, dateFilter, searchType, searchValue])

  const hasActiveFilters = statusFilter !== 'all' || dateFilter !== 'all' || searchValue.trim() !== ''

  const clearFilters = () => {
    setStatusFilter('all')
    setDateFilter('all')
    setSearchValue('')
  }

  return (
    <div className="space-y-8">
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
            {/* Search - by customer name or demand ID */}
            <div className="md:col-span-2 flex gap-2">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">Search by</label>
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as 'customer' | 'demand_id')}
                  className="w-full border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 rounded text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                >
                  <option value="customer" className="bg-zinc-50 dark:bg-black">Customer name</option>
                  <option value="demand_id" className="bg-zinc-50 dark:bg-black">Demand ID</option>
                </select>
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">
                  {searchType === 'customer' ? 'Name' : 'Demand ID'}
                </label>
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={searchType === 'customer' ? 'Customer first or last name...' : 'ARR20260000001'}
                  className="w-full border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 rounded text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>
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

      {/* My Assigned Demands */}
      {filteredMyAssigned.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            My Assigned Demands ({filteredMyAssigned.length})
          </h2>
          <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 shadow overflow-hidden">
            <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
              {filteredMyAssigned.map(demand => (
                <li key={demand.id} className="p-4 sm:px-6 hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-lg font-medium text-[#C27E00]">
                          {demand.customer_firstname} {demand.customer_lastname}
                        </p>
                        {demand.demand_number != null && (
                          <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">#{demand.demand_number}</span>
                        )}
                        {demand.stock_number && duplicateStockNumbers.includes((demand.stock_number || '').trim().toUpperCase()) && (
                          <span className="text-xs text-amber-400">(Duplicate Stock No)</span>
                        )}
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-800">
                          ASSIGNED TO ME
                        </span>
                        {demand.status === 'pending_finance' && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-800">
                            PENDING
                          </span>
                        )}
                        {demand.status === 'approved' && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-green-900/50 text-green-300 border border-green-800">
                            APPROVED
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-gray-400">
                        {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-gray-400">
                        Appointment: <span className="font-semibold text-zinc-900 dark:text-white">{formatAppointment(demand.appointment_date, demand.dealers)}</span>
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-gray-500 mt-1">
                        Dealer: {(Array.isArray(demand.dealers) ? demand.dealers[0] : demand.dealers)?.name}
                      </p>
                      {demand.comment && (
                        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1 italic">Comment: {demand.comment}</p>
                      )}
                    </div>
                    <DemandActions 
                      demandId={demand.id} 
                      isAssigned={true} 
                      status={demand.status}
                      demand={{
                        id: demand.id,
                        demand_number: demand.demand_number,
                        dealer_id: demand.dealer_id,
                        customer_firstname: demand.customer_firstname,
                        customer_lastname: demand.customer_lastname,
                        customer_phone: demand.customer_phone,
                        customer_address: demand.customer_address,
                        vehicle_make: demand.vehicle_make,
                        vehicle_model: demand.vehicle_model,
                        vehicle_year: demand.vehicle_year,
                        stock_number: demand.stock_number,
                        camera_model: demand.camera_model,
                        appointment_date: demand.appointment_date,
                        assigned_specialist_id: demand.assigned_specialist_id
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Demand Pool - Unassigned Demands */}
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
          Demand Pool - Unassigned ({filteredUnassigned.length})
        </h2>
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 shadow overflow-hidden">
          {filteredUnassigned.length === 0 ? (
            <p className="p-4 text-zinc-500 dark:text-gray-400 text-center">
              {hasActiveFilters ? 'No unassigned demands match your filters.' : 'No unassigned demands in the pool.'}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
              {filteredUnassigned.map(demand => (
                <li key={demand.id} className="p-4 sm:px-6 hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-lg font-medium text-zinc-900 dark:text-white">
                          {demand.customer_firstname} {demand.customer_lastname}
                        </p>
                        {demand.demand_number != null && (
                          <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">#{demand.demand_number}</span>
                        )}
                        {demand.stock_number && duplicateStockNumbers.includes((demand.stock_number || '').trim().toUpperCase()) && (
                          <span className="text-xs text-amber-400">(Duplicate Stock No)</span>
                        )}
                        <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-200/80 dark:bg-gray-900/50 text-zinc-600 dark:text-gray-300 border border-zinc-200 dark:border-gray-800">
                          UNASSIGNED
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-gray-400">
                        {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-gray-400">
                        Appointment: <span className="font-semibold text-zinc-900 dark:text-white">{formatAppointment(demand.appointment_date, demand.dealers)}</span>
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-gray-500 mt-1">
                        Dealer: {(Array.isArray(demand.dealers) ? demand.dealers[0] : demand.dealers)?.name}
                      </p>
                      {demand.comment && (
                        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1 italic">Comment: {demand.comment}</p>
                      )}
                      <p className="text-xs text-zinc-600 dark:text-gray-600 mt-1">
                        Created: {formatInTimeZone(new Date(demand.created_at), getEffectiveTimezone(getDealerTimezone(demand.dealers) ?? null), 'PPP h:mm a')}
                      </p>
                    </div>
                    <DemandActions demandId={demand.id} isAssigned={false} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Completed Demands */}
      {filteredCompleted.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            Completed ({filteredCompleted.length})
          </h2>
          <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 shadow overflow-hidden">
            <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
              {filteredCompleted.map(demand => (
                <li key={demand.id} className="p-4 sm:px-6 hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-lg font-medium text-zinc-500 dark:text-gray-400">
                          {demand.customer_firstname} {demand.customer_lastname}
                        </p>
                        {demand.demand_number != null && (
                          <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">#{demand.demand_number}</span>
                        )}
                        {demand.stock_number && duplicateStockNumbers.includes((demand.stock_number || '').trim().toUpperCase()) && (
                          <span className="text-xs text-amber-400">(Duplicate Stock No)</span>
                        )}
                        <span className="px-2 py-1 rounded text-xs font-medium bg-green-900/50 text-green-300 border border-green-800">
                          COMPLETED
                        </span>
                        {demand.profiles && (
                          <span className="text-xs text-zinc-500 dark:text-gray-500">
                            Finance: {(demand.profiles as any)?.full_name || '—'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-gray-500">
                        {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-gray-500">
                        Appointment: {formatAppointment(demand.appointment_date, demand.dealers)}
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-gray-600 mt-1">
                        Dealer: {(Array.isArray(demand.dealers) ? demand.dealers[0] : demand.dealers)?.name}
                      </p>
                      {demand.comment && (
                        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1 italic">Comment: {demand.comment}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Other Assigned Demands (for reference) */}
      {filteredAllAssigned.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            Assigned to Others ({filteredAllAssigned.length})
          </h2>
          <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 shadow overflow-hidden">
            <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
              {filteredAllAssigned.map(demand => (
                <li key={demand.id} className="p-4 sm:px-6 hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-lg font-medium text-zinc-500 dark:text-gray-500">
                          {demand.customer_firstname} {demand.customer_lastname}
                        </p>
                        {demand.demand_number != null && (
                          <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">#{demand.demand_number}</span>
                        )}
                        {demand.stock_number && duplicateStockNumbers.includes((demand.stock_number || '').trim().toUpperCase()) && (
                          <span className="text-xs text-amber-400">(Duplicate Stock No)</span>
                        )}
                        <span className="px-2 py-1 rounded text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-800">
                          ASSIGNED TO: {(demand.profiles as any)?.full_name || 'Unknown'}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-gray-500">
                        {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-gray-500">
                        Appointment: {formatAppointment(demand.appointment_date, demand.dealers)}
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-gray-600 mt-1">
                        Dealer: {(Array.isArray(demand.dealers) ? demand.dealers[0] : demand.dealers)?.name}
                      </p>
                      {demand.comment && (
                        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1 italic">Comment: {demand.comment}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

