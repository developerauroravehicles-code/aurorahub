'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone, getPTDateRanges } from '@/lib/timezone-defaults'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { Filter, X, Plus } from 'lucide-react'
import Link from 'next/link'
import { demandMatchesSmartSearch } from '@/lib/demand-smart-search'
import { CreateExternalDemandForm } from './create-external-demand-form'

interface Dealer {
  id: string
  name: string
}

interface Specialist {
  id: string
  full_name: string | null
}

interface Demand {
  id: string
  demand_number?: number | string
  status: string
  created_at: string
  customer_firstname: string
  customer_lastname: string
  customer_phone?: string | null
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  appointment_date: string
  is_external?: boolean | null
  vin_last6?: string | null
  stock_number?: string | null
  dealers?: { name: string; region_codes?: { timezones?: { name: string } | Array<{ name: string }> } | Array<{ timezones?: { name: string } | Array<{ name: string }> }> } | null
  profiles?: { full_name: string } | null
  assigned_specialist?: { full_name: string } | null
  assigned_finance?: { full_name: string } | null
}

interface DemandsListProps {
  demands: Demand[]
  dealers: Dealer[]
  specialists: Specialist[]
  selectedDealerId: string
  canCreateExternal?: boolean
  hideDealerFilter?: boolean
  duplicateStockNumbers?: string[]
}

const ADMIN_DEMANDS_FILTERS_KEY = 'aurora_admin_demands_filters_v1'

function buildPersistQS(
  dateFilter: string,
  statusFilter: string,
  selectedDealerId: string,
  hideDealerFilter: boolean
): string {
  const p = new URLSearchParams()
  if (dateFilter !== 'all') p.set('date', dateFilter)
  if (statusFilter !== 'all') p.set('status', statusFilter)
  if (!hideDealerFilter && selectedDealerId !== 'all') p.set('dealer', selectedDealerId)
  return p.toString()
}

/** True when both query strings encode the same key/value pairs. */
function paramsEqual(a: string, b: string): boolean {
  const pa = new URLSearchParams(a)
  const pb = new URLSearchParams(b)
  const keys = new Set([...pa.keys(), ...pb.keys()])
  for (const k of keys) {
    if (pa.get(k) !== pb.get(k)) return false
  }
  return true
}

export function DemandsList({ demands, dealers, specialists, selectedDealerId, canCreateExternal, hideDealerFilter, duplicateStockNumbers = [] }: DemandsListProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const router = useRouter()

  const handleCreateSuccess = () => {
    setCreateModalOpen(false)
    router.refresh()
  }
  const searchParams = useSearchParams()

  const handleDealerChange = (dealerId: string) => {
    const qs = buildPersistQS(dateFilter, statusFilter, dealerId, !!hideDealerFilter)
    router.push(qs ? `/dashboard/admin/demands?${qs}` : '/dashboard/admin/demands')
  }

  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get('status') ?? 'all')
  const [dateFilter, setDateFilter] = useState<string>(() => searchParams.get('date') ?? 'all')

  const filtersBootstrapped = useRef(false)
  const prevListSearchRef = useRef<string | undefined>(undefined)

  /**
   * - Restore from session once if URL has no filters.
   * - When the URL changes (Back/Forward), merge date/status from the URL without clobbering
   *   in-progress dropdown changes (same URL, state-only update).
   * - Persist filters to sessionStorage and sync the address bar from effective filters.
   */
  useEffect(() => {
    const cur = searchParams.toString()
    const urlChanged = prevListSearchRef.current !== undefined && cur !== prevListSearchRef.current

    if (!filtersBootstrapped.current) {
      filtersBootstrapped.current = true
      const hasUrl =
        searchParams.has('date') ||
        searchParams.has('status') ||
        (!hideDealerFilter && searchParams.has('dealer'))
      if (!hasUrl) {
        try {
          const raw = sessionStorage.getItem(ADMIN_DEMANDS_FILTERS_KEY)
          if (raw) {
            const sp = new URLSearchParams(raw)
            setDateFilter(sp.get('date') ?? 'all')
            setStatusFilter(sp.get('status') ?? 'all')
            router.replace(`/dashboard/admin/demands?${raw}`, { scroll: false })
            prevListSearchRef.current = cur
            return
          }
        } catch {
          /* ignore */
        }
      }
    }

    const p = new URLSearchParams(cur)
    let effectiveDate = dateFilter
    let effectiveStatus = statusFilter
    if (urlChanged) {
      if (p.has('date')) {
        effectiveDate = p.get('date') ?? 'all'
        if (effectiveDate !== dateFilter) setDateFilter(effectiveDate)
      }
      if (p.has('status')) {
        effectiveStatus = p.get('status') ?? 'all'
        if (effectiveStatus !== statusFilter) setStatusFilter(effectiveStatus)
      }
    }

    const qs = buildPersistQS(effectiveDate, effectiveStatus, selectedDealerId, !!hideDealerFilter)
    try {
      if (qs) sessionStorage.setItem(ADMIN_DEMANDS_FILTERS_KEY, qs)
      else sessionStorage.removeItem(ADMIN_DEMANDS_FILTERS_KEY)
    } catch {
      /* ignore */
    }
    if (!paramsEqual(qs, cur)) {
      router.replace(qs ? `/dashboard/admin/demands?${qs}` : '/dashboard/admin/demands', { scroll: false })
    }
    prevListSearchRef.current = cur
  }, [dateFilter, statusFilter, selectedDealerId, hideDealerFilter, searchParams, router])

  const persistQueryString = useMemo(
    () => buildPersistQS(dateFilter, statusFilter, selectedDealerId, !!hideDealerFilter),
    [dateFilter, statusFilter, selectedDealerId, hideDealerFilter]
  )
  const [searchValue, setSearchValue] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const dealerFilterActive = !hideDealerFilter && selectedDealerId !== 'all'

  const filteredDemands = useMemo(() => {
    let filtered = [...demands]

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter)
    }

    // Date filter (HQ uses PT)
    if (dateFilter !== 'all') {
      const { today, week, month } = getPTDateRanges()
      if (dateFilter === 'today') {
        filtered = filtered.filter(d => {
          const t = d.appointment_date
          return t >= today.start && t <= today.end
        })
      } else if (dateFilter === 'this_week') {
        filtered = filtered.filter(d => {
          const t = d.appointment_date
          return t >= week.start && t < week.end
        })
      } else if (dateFilter === 'this_month') {
        filtered = filtered.filter(d => {
          const t = d.appointment_date
          return t >= month.start && t <= month.end
        })
      }
    }

    if (searchValue.trim()) {
      filtered = filtered.filter(d => demandMatchesSmartSearch(d, searchValue))
    }

    return filtered
  }, [demands, statusFilter, dateFilter, searchValue])

  const hasActiveFilters = statusFilter !== 'all' || dateFilter !== 'all' || searchValue.trim() !== '' || dealerFilterActive

  const clearFilters = () => {
    setStatusFilter('all')
    setDateFilter('all')
    setSearchValue('')
    try {
      sessionStorage.removeItem(ADMIN_DEMANDS_FILTERS_KEY)
    } catch {
      /* ignore */
    }
    const p = new URLSearchParams(searchParams.toString())
    p.delete('date')
    p.delete('status')
    if (dealerFilterActive) {
      p.delete('dealer')
    }
    const qs = p.toString()
    router.replace(qs ? `/dashboard/admin/demands?${qs}` : '/dashboard/admin/demands', { scroll: false })
  }

  return (
    <div className="space-y-4">
      {/* Dealer filter and Create External button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {hideDealerFilter ? (
            <span className="text-sm text-zinc-500 dark:text-gray-400">
              Dealer: {dealers.find(d => d.id === selectedDealerId)?.name ?? selectedDealerId}
            </span>
          ) : (
            <>
              <label className="text-sm font-medium text-zinc-500 dark:text-gray-400">Dealer:</label>
              <select
                value={selectedDealerId}
                onChange={(e) => handleDealerChange(e.target.value)}
                className="border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 rounded text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] min-w-[200px]"
              >
                <option value="all" className="bg-zinc-50 dark:bg-black">All Dealers</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id} className="bg-zinc-50 dark:bg-black">{d.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
        {canCreateExternal && (
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-[#C27E00] hover:bg-[#a06900] rounded-md"
          >
            <Plus className="w-4 h-4" />
            Create External Demand
          </button>
        )}
      </div>

      {/* Create External Demand Modal */}
      {createModalOpen && canCreateExternal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 dark:bg-black/70">
          <div className="bg-zinc-200 dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <CreateExternalDemandForm
                dealers={dealers}
                specialists={specialists}
                onSuccess={handleCreateSuccess}
                onCancel={() => setCreateModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

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
                Matches customer name, phone, VIN (last 6), stock number, demand reference (OR).
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
        {filteredDemands.length === 0 ? (
          <p className="p-4 text-zinc-500 dark:text-gray-400 text-center">
            {hasActiveFilters ? 'No demands match your filters.' : 'No demands found.'}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
            {filteredDemands.map(demand => {
              const statusColors = {
                pending_finance: 'bg-yellow-500/20 text-yellow-400',
                approved: 'bg-blue-500/20 text-blue-400',
                completed: 'bg-green-500/20 text-green-400',
                cancelled: 'bg-red-500/20 text-red-400'
              }
              const detailHref =
                persistQueryString !== ''
                  ? `/dashboard/admin/demands/${demand.id}?${persistQueryString}`
                  : `/dashboard/admin/demands/${demand.id}`

              const dealerTz = getEffectiveTimezone(getTimezoneFromDealer(demand.dealers as Parameters<typeof getTimezoneFromDealer>[0]))

              return (
                <li key={demand.id} className="p-4 hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
                  <Link href={detailHref} className="block">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-medium text-[#C27E00] hover:text-[#a06900] transition-colors">
                            {demand.customer_firstname} {demand.customer_lastname}
                          </p>
                          {demand.demand_number != null && (
                            <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">#{demand.demand_number}</span>
                          )}
                          {demand.stock_number && duplicateStockNumbers.includes((demand.stock_number as string).trim().toUpperCase()) && (
                            <span className="text-xs text-amber-400">(Duplicate Stock No)</span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-gray-500">
                          Appointment: {demand.is_external
                            ? formatInTimeZone(new Date(demand.appointment_date), dealerTz, 'PPP') + ' (External)'
                            : formatInTimeZone(new Date(demand.appointment_date), dealerTz, 'PPP h:mm a')}
                        </p>
                        <p className="text-xs text-zinc-600 dark:text-gray-600 mt-1">
                          Dealer: {(demand.dealers as any)?.name || 'Unknown'} | Created by: {(demand.profiles as any)?.full_name || 'Unknown'}
                          {demand.vin_last6
                            ? ` | VIN: ${demand.vin_last6.toUpperCase()}`
                            : ' | VIN: —'}
                          {' | Finance: '}
                          {(demand.assigned_finance as any)?.full_name || '—'}
                          {' | Specialist: '}
                          {(demand.assigned_specialist as any)?.full_name || '—'}
                        </p>
                      </div>
                      <div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                          statusColors[demand.status as keyof typeof statusColors] || 'bg-gray-500/20 text-zinc-500 dark:text-gray-400'
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

