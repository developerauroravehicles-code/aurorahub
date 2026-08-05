'use client'

import { useState, useMemo } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone } from '@/lib/timezone-defaults'
import { Filter, X } from 'lucide-react'
import { demandMatchesSmartSearch } from '@/lib/demand-smart-search'
import { DemandPrintButton } from '@/components/demand-print-button'
import { toHandoffDemand } from '@/lib/demand-handoff-print-utils'
import { DemandActions } from './demand-actions'

type DealerRow = { name: string; region_codes?: { timezones?: { name: string } } } | null

interface Demand {
  id: string
  demand_number?: number | string
  status: string
  created_at: string
  dealer_id?: string | null
  assigned_finance_id?: string | null
  customer_firstname: string
  customer_lastname: string
  customer_phone: string
  customer_address: string | null
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  stock_number: string | null
  vin_last6?: string | null
  camera_model: string
  appointment_date: string
  assigned_specialist_id?: string | null
  comment?: string | null
  dealers?: DealerRow | DealerRow[] | null
  profiles?: { full_name: string } | null
}

interface FinanceDemandsListProps {
  activeDemands: Demand[]
  completedDemands: Demand[]
  currentUserId: string
  duplicateStockNumbers?: string[]
  dealer: { name: string; warranty_years: number | null }
  timezoneName: string | null
}

function getDealerTimezone(dealers: Demand['dealers']): string | null {
  if (!dealers) return null
  const d = Array.isArray(dealers) ? dealers[0] : dealers
  return (d as DealerRow)?.region_codes?.timezones?.name ?? null
}

function formatAppointment(appointmentDate: string, dealers: Demand['dealers']): string {
  const tz = getDealerTimezone(dealers)
  return formatInTimeZone(
    new Date(appointmentDate),
    getEffectiveTimezone(tz ?? null),
    'PPP h:mm a'
  )
}

function getDealerName(dealers: Demand['dealers']): string | undefined {
  const d = Array.isArray(dealers) ? dealers[0] : dealers
  return (d as DealerRow)?.name
}

function sortNewestFirst(demands: Demand[]): Demand[] {
  return [...demands].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

function filterDemands(
  demands: Demand[],
  statusFilter: string,
  dateFilter: string,
  searchValue: string
): Demand[] {
  let filtered = [...demands]

  if (statusFilter !== 'all') {
    filtered = filtered.filter((d) => d.status === statusFilter)
  }

  if (dateFilter !== 'all') {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (dateFilter === 'today') {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      filtered = filtered.filter((d) => {
        const appointmentDate = new Date(d.appointment_date)
        return appointmentDate >= today && appointmentDate < tomorrow
      })
    } else if (dateFilter === 'this_week') {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 7)
      filtered = filtered.filter((d) => {
        const appointmentDate = new Date(d.appointment_date)
        return appointmentDate >= weekStart && appointmentDate < weekEnd
      })
    } else if (dateFilter === 'this_month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      filtered = filtered.filter((d) => {
        const appointmentDate = new Date(d.appointment_date)
        return appointmentDate >= monthStart && appointmentDate < monthEnd
      })
    }
  }

  if (searchValue.trim()) {
    filtered = filtered.filter((d) => demandMatchesSmartSearch(d, searchValue))
  }

  return sortNewestFirst(filtered)
}

function DemandRow({
  demand,
  currentUserId,
  duplicateStockNumbers,
  dealer,
  timezoneName,
  muted = false,
}: {
  demand: Demand
  currentUserId: string
  duplicateStockNumbers: string[]
  dealer: { name: string; warranty_years: number | null }
  timezoneName: string | null
  muted?: boolean
}) {
  const isMine = demand.assigned_finance_id === currentUserId
  const isUnassigned = !demand.assigned_finance_id
  const financeName = (demand.profiles as { full_name?: string } | null)?.full_name
  const nameClass = muted
    ? 'text-lg font-medium text-zinc-500 dark:text-gray-500'
    : 'text-lg font-medium text-zinc-900 dark:text-white'

  return (
    <li className="p-4 sm:px-6 hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <p className={isMine && !muted ? 'text-lg font-medium text-[#C27E00]' : nameClass}>
              {demand.customer_firstname} {demand.customer_lastname}
            </p>
            {demand.demand_number != null && (
              <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">
                #{demand.demand_number}
              </span>
            )}
            {demand.stock_number &&
              duplicateStockNumbers.includes((demand.stock_number || '').trim().toUpperCase()) && (
                <span className="text-xs text-amber-400">(Duplicate Stock No)</span>
              )}
            {isUnassigned && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-200/80 dark:bg-gray-900/50 text-zinc-600 dark:text-gray-300 border border-zinc-200 dark:border-gray-800">
                UNASSIGNED
              </span>
            )}
            {isMine && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-800">
                ASSIGNED TO ME
              </span>
            )}
            {!isUnassigned && !isMine && financeName && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-800">
                FINANCE: {financeName}
              </span>
            )}
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
            {demand.status === 'completed' && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-green-900/50 text-green-300 border border-green-800">
                COMPLETED
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 dark:text-gray-400">
            {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
          </p>
          <p className="text-sm text-zinc-500 dark:text-gray-400">
            Appointment:{' '}
            <span className="font-semibold text-zinc-900 dark:text-white">
              {formatAppointment(demand.appointment_date, demand.dealers)}
            </span>
          </p>
          <p className="text-sm text-zinc-500 dark:text-gray-500 mt-1">
            Dealer: {getDealerName(demand.dealers) ?? '—'}
          </p>
          {demand.comment && (
            <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1 italic">
              Comment: {demand.comment}
            </p>
          )}
          <p className="text-xs text-zinc-600 dark:text-gray-600 mt-1">
            Created:{' '}
            {formatInTimeZone(
              new Date(demand.created_at),
              getEffectiveTimezone(getDealerTimezone(demand.dealers) ?? null),
              'PPP h:mm a'
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <DemandPrintButton
            demand={toHandoffDemand(demand)}
            dealer={dealer}
            timezoneName={timezoneName}
          />
          {(isUnassigned || isMine) && demand.status !== 'completed' && (
            <DemandActions
              demandId={demand.id}
              isAssigned={isMine}
              status={demand.status}
              demand={
                isMine
                  ? {
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
                      assigned_specialist_id: demand.assigned_specialist_id,
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </li>
  )
}

export function FinanceDemandsList({
  activeDemands,
  completedDemands,
  currentUserId,
  duplicateStockNumbers = [],
  dealer,
  timezoneName,
}: FinanceDemandsListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [searchValue, setSearchValue] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  const filteredActive = useMemo(
    () => filterDemands(activeDemands, statusFilter, dateFilter, searchValue),
    [activeDemands, statusFilter, dateFilter, searchValue]
  )

  const filteredCompleted = useMemo(
    () => filterDemands(completedDemands, statusFilter, dateFilter, searchValue),
    [completedDemands, statusFilter, dateFilter, searchValue]
  )

  const showActiveSection =
    statusFilter === 'all' ||
    statusFilter === 'pending_finance' ||
    statusFilter === 'approved'
  const showCompletedSection = statusFilter === 'all' || statusFilter === 'completed'

  const hasActiveFilters =
    statusFilter !== 'all' || dateFilter !== 'all' || searchValue.trim() !== ''

  const clearFilters = () => {
    setStatusFilter('all')
    setDateFilter('all')
    setSearchValue('')
  }

  const totalVisible =
    (showActiveSection ? filteredActive.length : 0) +
    (showCompletedSection ? filteredCompleted.length : 0)

  return (
    <div className="space-y-8">
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
              <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">
                Search
              </label>
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

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 rounded text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
              >
                <option value="all" className="bg-zinc-50 dark:bg-black">
                  All Status
                </option>
                <option value="pending_finance" className="bg-zinc-50 dark:bg-black">
                  Pending Finance
                </option>
                <option value="approved" className="bg-zinc-50 dark:bg-black">
                  Approved
                </option>
                <option value="completed" className="bg-zinc-50 dark:bg-black">
                  Completed
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">
                Date Range
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 rounded text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
              >
                <option value="all" className="bg-zinc-50 dark:bg-black">
                  All Time
                </option>
                <option value="today" className="bg-zinc-50 dark:bg-black">
                  Today
                </option>
                <option value="this_week" className="bg-zinc-50 dark:bg-black">
                  This Week
                </option>
                <option value="this_month" className="bg-zinc-50 dark:bg-black">
                  This Month
                </option>
              </select>
            </div>
          </div>
        )}
      </div>

      {showActiveSection && (
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            Pending &amp; Approved ({filteredActive.length})
          </h2>
          <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 shadow overflow-hidden">
            {filteredActive.length === 0 ? (
              <p className="p-4 text-zinc-500 dark:text-gray-400 text-center">
                {hasActiveFilters
                  ? 'No pending or approved demands match your filters.'
                  : 'No pending or approved demands.'}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
                {filteredActive.map((demand) => (
                  <DemandRow
                    key={demand.id}
                    demand={demand}
                    currentUserId={currentUserId}
                    duplicateStockNumbers={duplicateStockNumbers}
                    dealer={dealer}
                    timezoneName={timezoneName}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showCompletedSection && (
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            Completed ({filteredCompleted.length})
          </h2>
          <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 shadow overflow-hidden">
            {filteredCompleted.length === 0 ? (
              <p className="p-4 text-zinc-500 dark:text-gray-400 text-center">
                {hasActiveFilters
                  ? 'No completed demands match your filters.'
                  : 'No completed demands.'}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
                {filteredCompleted.map((demand) => (
                  <DemandRow
                    key={demand.id}
                    demand={demand}
                    currentUserId={currentUserId}
                    duplicateStockNumbers={duplicateStockNumbers}
                    dealer={dealer}
                    timezoneName={timezoneName}
                    muted
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {totalVisible === 0 && !showActiveSection && !showCompletedSection && (
        <p className="text-zinc-500 dark:text-gray-400 text-center py-8">
          No demands match your filters.
        </p>
      )}
    </div>
  )
}
