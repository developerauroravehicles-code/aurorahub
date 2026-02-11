'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { getEffectiveTimezone, SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

// Supabase may return dealers as single object or array; timezones/region_codes can be arrays
type DealerRelation =
  | { region_codes?: { timezones?: { name: string } | { name: string }[] } | Array<{ timezone_id?: unknown; timezones?: { name: string } | { name: string }[] }> }
  | null
interface Demand {
  id: string
  customer_firstname: string
  customer_lastname: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  camera_model: string
  appointment_date: string
  status: string
  created_at: string
  dealer_id: string
  assigned_specialist_id: string | null
  assigned_finance_id: string | null
  created_by: string | null
  dealers?: DealerRelation | DealerRelation[] | null
}

function getDealerTz(demand: Demand): string | null {
  const d = demand.dealers
  if (!d) return null
  const dealer = Array.isArray(d) ? d[0] : d
  const rc = dealer?.region_codes
  if (!rc) return null
  const region = Array.isArray(rc) ? rc[0] : rc
  const tz = region?.timezones
  if (!tz) return null
  const t = Array.isArray(tz) ? tz[0] : tz
  return (t as { name?: string })?.name ?? null
}

interface Dealer {
  id: string
  name: string
}

interface Employee {
  id: string
  full_name: string
  dealer_id: string
  role: string
}

export default function AdminReportsPage() {
  const [demands, setDemands] = useState<Demand[]>([])
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')
  const [userDealerId, setUserDealerId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(formatInTimeZone(startOfMonth(new Date()), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(formatInTimeZone(endOfMonth(new Date()), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd'))
  const [selectedDealerId, setSelectedDealerId] = useState<string>('all')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all')
  const supabase = createClient()

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchDemands()
  }, [startDate, endDate, selectedDealerId, selectedEmployeeId])

  const fetchInitialData = async () => {
    try {
      // Get current user profile to check role and dealer_id
      const { data: { user } } = await supabase.auth.getUser()
      let currentUserRole = ''
      let currentUserDealerId: string | null = null

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, dealer_id')
          .eq('id', user.id)
          .single()

        if (profile) {
          currentUserRole = profile.role
          currentUserDealerId = profile.dealer_id
          setUserRole(profile.role)
          setUserDealerId(profile.dealer_id)

          // If General Manager, set selected dealer to their dealer
          if (profile.role === 'general_manager' && profile.dealer_id) {
            setSelectedDealerId(profile.dealer_id)
          }
        }
      }

      // Fetch dealers - filter by user's dealer if General Manager
      let dealersQuery = supabase
        .from('dealers')
        .select('id, name')
        .order('name')

      if (currentUserRole === 'general_manager' && currentUserDealerId) {
        dealersQuery = dealersQuery.eq('id', currentUserDealerId)
      }

      const { data: dealersData } = await dealersQuery

      if (dealersData) {
        setDealers(dealersData)
      }

      // Fetch all employees (sales, finance, specialist)
      const { data: employeesData } = await supabase
        .from('profiles')
        .select('id, full_name, dealer_id, role')
        .in('role', ['sales', 'finance', 'specialist'])
        .order('role')
        .order('full_name')

      if (employeesData) {
        setEmployees(employeesData)
      }

      await fetchDemands()
    } catch (error) {
      console.error('Error fetching initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDemands = async () => {
    setLoading(true)
    try {
      // Get user role and dealer_id if not already set
      let currentUserRole = userRole
      let currentUserDealerId = userDealerId

      if (!currentUserRole) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, dealer_id')
            .eq('id', user.id)
            .single()

          if (profile) {
            currentUserRole = profile.role
            currentUserDealerId = profile.dealer_id
            setUserRole(profile.role)
            setUserDealerId(profile.dealer_id)
          }
        }
      }

      const [sy, sm, sd] = startDate.split('-').map(Number)
      const [ey, em, ed] = endDate.split('-').map(Number)
      const rangeStart = fromZonedTime(new Date(sy, sm - 1, sd, 0, 0, 0), SYSTEM_DEFAULT_TIMEZONE).toISOString()
      const rangeEnd = fromZonedTime(new Date(ey, em - 1, ed, 23, 59, 59, 999), SYSTEM_DEFAULT_TIMEZONE).toISOString()

      let query = supabase
        .from('demands')
        .select('id, status, created_at, camera_model, vehicle_make, vehicle_model, vehicle_year, appointment_date, dealer_id, assigned_specialist_id, assigned_finance_id, created_by, customer_firstname, customer_lastname, dealers(region_codes(timezone_id, timezones(name)))')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd)

      // Filter by dealer
      // If General Manager, always filter by their dealer
      if (currentUserRole === 'general_manager' && currentUserDealerId) {
        query = query.eq('dealer_id', currentUserDealerId)
      } else if (selectedDealerId !== 'all') {
        query = query.eq('dealer_id', selectedDealerId)
      }

      // Filter by employee (based on role)
      if (selectedEmployeeId !== 'all') {
        const selectedEmployee = employees.find(e => e.id === selectedEmployeeId)
        if (selectedEmployee) {
          if (selectedEmployee.role === 'specialist') {
            query = query.eq('assigned_specialist_id', selectedEmployeeId)
          } else if (selectedEmployee.role === 'sales') {
            query = query.eq('created_by', selectedEmployeeId)
          } else if (selectedEmployee.role === 'finance') {
            query = query.eq('assigned_finance_id', selectedEmployeeId)
          }
        }
      }

      const { data: demandsData, error } = await query
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching demands:', error)
      } else {
        setDemands(demandsData || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics
  const totalDemands = demands.length
  const totalAppointments = demands.length
  const cameraCounts = demands.reduce((acc, demand) => {
    const camera = demand.camera_model || 'Unknown'
    acc[camera] = (acc[camera] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const statusCounts = demands.reduce((acc, demand) => {
    const status = demand.status || 'unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const vehicleMakeCounts = demands.reduce((acc, demand) => {
    const make = demand.vehicle_make || 'Unknown'
    acc[make] = (acc[make] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const setDateRange = (months: number) => {
    const end = new Date()
    const start = subMonths(end, months)
    setStartDate(formatInTimeZone(startOfMonth(start), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd'))
    setEndDate(formatInTimeZone(endOfMonth(end), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd'))
  }

  // Update employees when dealer changes
  useEffect(() => {
    if (selectedDealerId !== 'all') {
      const filteredEmployees = employees.filter(e => e.dealer_id === selectedDealerId)
      // If current employee is not in filtered list, reset to 'all'
      if (selectedEmployeeId !== 'all' && !filteredEmployees.find(e => e.id === selectedEmployeeId)) {
        setSelectedEmployeeId('all')
      }
    }
  }, [selectedDealerId, employees, selectedEmployeeId])

  const filteredEmployees = selectedDealerId !== 'all' 
    ? employees.filter(e => e.dealer_id === selectedDealerId)
    : employees

  // Group employees by role
  const employeesByRole = filteredEmployees.reduce((acc, employee) => {
    if (!acc[employee.role]) {
      acc[employee.role] = []
    }
    acc[employee.role].push(employee)
    return acc
  }, {} as Record<string, Employee[]>)

  const roleLabels: Record<string, string> = {
    sales: 'Sales',
    finance: 'Finance',
    specialist: 'Specialist'
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Admin Reports</h1>
        <p className="text-gray-400">View detailed reports filtered by dealer and specialist</p>
      </div>

      {/* Filters */}
      <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Dealer Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Dealer</label>
            <select
              value={selectedDealerId}
              onChange={(e) => setSelectedDealerId(e.target.value)}
              disabled={userRole === 'general_manager'}
              className="w-full border border-gray-700 bg-white/5 p-2 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {userRole === 'general_manager' ? (
                dealers.map(dealer => (
                  <option key={dealer.id} value={dealer.id} className="bg-black text-white">
                    {dealer.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="all" className="bg-black text-white">All Dealers</option>
                  {dealers.map(dealer => (
                    <option key={dealer.id} value={dealer.id} className="bg-black text-white">
                      {dealer.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Employee Filter - Categorized by Role */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Personel</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              disabled={filteredEmployees.length === 0}
              className="w-full border border-gray-700 bg-white/5 p-2 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="all" className="bg-black text-white">All Personnel</option>
              {Object.entries(employeesByRole).map(([role, roleEmployees]) => (
                <optgroup key={role} label={roleLabels[role] || role} className="bg-black">
                  {roleEmployees.map(employee => (
                    <option key={employee.id} value={employee.id} className="bg-black text-white pl-4">
                      {employee.full_name || 'Unknown'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-700 bg-white/5 p-2 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-700 bg-white/5 p-2 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            />
          </div>
        </div>

        {/* Quick Date Range Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setDateRange(1)}
            className="px-4 py-2 bg-white/5 border border-gray-700 text-white rounded hover:bg-white/10 transition-colors text-sm"
          >
            Last Month
          </button>
          <button
            onClick={() => setDateRange(3)}
            className="px-4 py-2 bg-white/5 border border-gray-700 text-white rounded hover:bg-white/10 transition-colors text-sm"
          >
            Last 3 Months
          </button>
          <button
            onClick={() => setDateRange(6)}
            className="px-4 py-2 bg-white/5 border border-gray-700 text-white rounded hover:bg-white/10 transition-colors text-sm"
          >
            Last 6 Months
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Loading reports...</p>
        </div>
      ) : (
        <>
          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Total Demands</h3>
              <p className="text-3xl font-bold text-white">{totalDemands}</p>
            </div>
            <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Total Appointments</h3>
              <p className="text-3xl font-bold text-white">{totalAppointments}</p>
            </div>
            <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Date Range</h3>
              <p className="text-sm text-white">
                {formatInTimeZone(new Date(startDate + 'T12:00:00Z'), SYSTEM_DEFAULT_TIMEZONE, 'MMM d, yyyy')} - {formatInTimeZone(new Date(endDate + 'T12:00:00Z'), SYSTEM_DEFAULT_TIMEZONE, 'MMM d, yyyy')}
              </p>
            </div>
          </div>

          {/* Camera Model Report */}
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Camera Models</h2>
            {Object.keys(cameraCounts).length === 0 ? (
              <p className="text-gray-400">No camera data available for this period.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(cameraCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([camera, count]) => (
                    <div key={camera} className="flex items-center justify-between p-3 bg-white/5 rounded border border-gray-800">
                      <span className="text-white font-medium">{camera}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400">{count} demand{count !== 1 ? 's' : ''}</span>
                        <div className="w-32 bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-[#C27E00] h-2 rounded-full"
                            style={{ width: `${(count / totalDemands) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400 w-12 text-right">
                          {totalDemands > 0 ? Math.round((count / totalDemands) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Status Report */}
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Status Breakdown</h2>
            {Object.keys(statusCounts).length === 0 ? (
              <p className="text-gray-400">No status data available for this period.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(statusCounts).map(([status, count]) => {
                  const statusColors = {
                    pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                    approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                    completed: 'bg-green-900/50 text-green-300 border-green-800',
                    cancelled: 'bg-red-900/50 text-red-300 border-red-800'
                  }
                  return (
                    <div
                      key={status}
                      className={`p-4 rounded-lg border ${statusColors[status as keyof typeof statusColors] || 'bg-gray-900/50 text-gray-300 border-gray-800'}`}
                    >
                      <p className="text-sm font-medium mb-1">
                        {status.replace('_', ' ').toUpperCase()}
                      </p>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs mt-1 opacity-75">
                        {totalDemands > 0 ? Math.round((count / totalDemands) * 100) : 0}% of total
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Vehicle Make Report */}
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Vehicle Makes</h2>
            {Object.keys(vehicleMakeCounts).length === 0 ? (
              <p className="text-gray-400">No vehicle data available for this period.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(vehicleMakeCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([make, count]) => (
                    <div key={make} className="flex items-center justify-between p-3 bg-white/5 rounded border border-gray-800">
                      <span className="text-white font-medium">{make}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400">{count} vehicle{count !== 1 ? 's' : ''}</span>
                        <div className="w-32 bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-[#C27E00] h-2 rounded-full"
                            style={{ width: `${(count / totalDemands) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400 w-12 text-right">
                          {totalDemands > 0 ? Math.round((count / totalDemands) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Detailed List */}
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Detailed Demand List</h2>
            {demands.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No demands found for the selected filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-800">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Vehicle</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Camera</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Appointment</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {demands.map((demand) => {
                      const statusColors = {
                        pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                        approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                        completed: 'bg-green-900/50 text-green-300 border-green-800',
                        cancelled: 'bg-red-900/50 text-red-300 border-red-800'
                      }
                      return (
                        <tr key={demand.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                            {demand.customer_firstname} {demand.customer_lastname}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {demand.camera_model}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(getDealerTz(demand) ?? null), 'MMM d, yyyy HH:mm')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-gray-900/50 text-gray-300 border-gray-800'}`}>
                              {demand.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                            {formatInTimeZone(new Date(demand.created_at), getEffectiveTimezone(getDealerTz(demand) ?? null), 'MMM d, yyyy')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

