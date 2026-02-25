import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import Link from 'next/link'
import { AppointmentAlerts, type AppointmentAlert } from './specialist/appointment-alerts'
import { getEffectiveTimezone, getTodayRangeInTimezone, SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // Get user profile to determine role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, dealer_id')
    .eq('id', user.id)
    .single()

  if (!profile) return <div className="text-white">Profile not found</div>

  // If sales user, fetch their demands
  if (profile.role === 'sales') {
    const { data: demands } = await supabase
      .from('demands')
      .select('id, demand_number, status, created_at, camera_model, vehicle_make, vehicle_model, vehicle_year, appointment_date, customer_firstname, customer_lastname')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    // Dealer timezone for appointment display (sales has single dealer)
    let salesTimezoneName: string | null = null
    if (profile.dealer_id) {
      const { data: dealer } = await supabase
        .from('dealers')
        .select('region_codes(timezone_id, timezones(name))')
        .eq('id', profile.dealer_id)
        .single()
      salesTimezoneName = (dealer?.region_codes as { timezones?: { name: string } } | null)?.timezones?.name ?? null
    }

    // Calculate statistics
    const totalDemands = demands?.length || 0
    const pendingFinance = demands?.filter(d => d.status === 'pending_finance').length || 0
    const approved = demands?.filter(d => d.status === 'approved').length || 0
    const completed = demands?.filter(d => d.status === 'completed').length || 0
    const cancelled = demands?.filter(d => d.status === 'cancelled').length || 0

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Welcome back! Here's an overview of your demands.</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Total Demands</h3>
            <p className="text-3xl font-bold text-white">{totalDemands}</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Pending Finance</h3>
            <p className="text-3xl font-bold text-yellow-500">{pendingFinance}</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Approved</h3>
            <p className="text-3xl font-bold text-blue-500">{approved}</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Completed</h3>
            <p className="text-3xl font-bold text-green-500">{completed}</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Cancelled</h3>
            <p className="text-3xl font-bold text-red-500">{cancelled}</p>
          </div>
        </div>

        {/* Recent Demands */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Your Demands</h2>
            <Link 
              href="/dashboard/sales/demands" 
              className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
            >
              View All →
            </Link>
          </div>
          
          <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
            {(!demands || demands.length === 0) ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 mb-4">You haven't created any demands yet.</p>
                <Link 
                  href="/dashboard/sales/demands/new" 
                  className="inline-flex items-center bg-[#C27E00] text-white px-4 py-2 rounded-md hover:bg-[#a06900] transition-colors"
                >
                  Create Your First Demand
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gray-800">
                {demands.slice(0, 10).map(demand => {
                  const statusColors = {
                    pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                    approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                    completed: 'bg-green-900/50 text-green-300 border-green-800',
                    cancelled: 'bg-red-900/50 text-red-300 border-red-800'
                  }
                  
                  return (
                    <li key={demand.id} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold text-white">
                              {demand.customer_firstname} {demand.customer_lastname}
                            </p>
                            {(demand as { demand_number?: number }).demand_number != null && (
                              <span className="text-xs font-medium text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                            )}
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-gray-900/50 text-gray-300 border-gray-800'}`}>
                              {demand.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">
                            {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Appointment: {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(salesTimezoneName), 'PPP h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {formatInTimeZone(new Date(demand.created_at), getEffectiveTimezone(salesTimezoneName), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    )
  }

  // If finance user, fetch their statistics (only from their dealer)
  if (profile.role === 'finance') {
    const dealerId = profile.dealer_id

    // Get all demands from this dealer for statistics
    const allDemandsQuery = supabase
      .from('demands')
      .select('id, status, created_at')
      .order('created_at', { ascending: false })
    const { data: allDemands } = dealerId
      ? await allDemandsQuery.eq('dealer_id', dealerId)
      : await allDemandsQuery.eq('dealer_id', '00000000-0000-0000-0000-000000000000')

    // Get assigned demands for this finance user (from this dealer)
    const assignedQuery = supabase
      .from('demands')
      .select('id, demand_number, status, created_at, customer_firstname, customer_lastname, vehicle_year, vehicle_make, vehicle_model, appointment_date, dealers(region_codes(timezone_id, timezones(name)))')
      .eq('assigned_finance_id', user.id)
      .order('created_at', { ascending: false })
    const { data: assignedDemandsRaw } = dealerId
      ? await assignedQuery.eq('dealer_id', dealerId)
      : await assignedQuery.eq('dealer_id', '00000000-0000-0000-0000-000000000000')
    const assignedDemands = assignedDemandsRaw ?? []

    // Calculate statistics
    const totalPending = allDemands?.filter(d => d.status === 'pending_finance').length || 0
    const totalApproved = allDemands?.filter(d => d.status === 'approved').length || 0
    const totalCompleted = allDemands?.filter(d => d.status === 'completed').length || 0
    const totalCancelled = allDemands?.filter(d => d.status === 'cancelled').length || 0
    const myAssigned = assignedDemands?.length || 0
    const myPending = assignedDemands?.filter(d => d.status === 'pending_finance').length || 0
    const myApproved = assignedDemands?.filter(d => d.status === 'approved').length || 0

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Finance Dashboard</h1>
          <p className="text-gray-400">Welcome back! Here's an overview of demands.</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Total Pending</h3>
            <p className="text-3xl font-bold text-yellow-500">{totalPending}</p>
            <p className="text-xs text-gray-500 mt-1">In demand pool</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">My Assigned</h3>
            <p className="text-3xl font-bold text-blue-500">{myAssigned}</p>
            <p className="text-xs text-gray-500 mt-1">{myPending} pending, {myApproved} approved</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Total Approved</h3>
            <p className="text-3xl font-bold text-green-500">{totalApproved}</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Total Completed</h3>
            <p className="text-3xl font-bold text-emerald-500">{totalCompleted}</p>
          </div>
        </div>

        {/* My Assigned Demands */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">My Assigned Demands</h2>
            <Link 
              href="/dashboard/finance/demands" 
              className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
            >
              View All →
            </Link>
          </div>
          
          <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
            {(!assignedDemands || assignedDemands.length === 0) ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 mb-4">You haven't assigned any demands yet.</p>
                <Link 
                  href="/dashboard/finance/demands" 
                  className="inline-flex items-center bg-[#C27E00] text-white px-4 py-2 rounded-md hover:bg-[#a06900] transition-colors"
                >
                  View Demand Pool
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gray-800">
                {assignedDemands.slice(0, 10).map(demand => {
                  const statusColors = {
                    pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                    approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                    completed: 'bg-green-900/50 text-green-300 border-green-800',
                    cancelled: 'bg-red-900/50 text-red-300 border-red-800'
                  }
                  
                  return (
                    <li key={demand.id} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold text-white">
                              {demand.customer_firstname} {demand.customer_lastname}
                            </p>
                            {(demand as { demand_number?: number }).demand_number != null && (
                              <span className="text-xs font-medium text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                            )}
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-gray-900/50 text-gray-300 border-gray-800'}`}>
                              {demand.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">
                            {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Appointment: {(() => {
                              const dealers = (demand as { dealers?: { region_codes?: { timezones?: { name: string } } } | null }).dealers
                              const tz = dealers?.region_codes?.timezones?.name ?? null
                              return formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(tz), 'PPP h:mm a')
                            })()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {formatInTimeZone(new Date(demand.created_at), getEffectiveTimezone((demand as { dealers?: { region_codes?: { timezones?: { name: string } } } | null }).dealers?.region_codes?.timezones?.name ?? null), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    )
  }

  // If specialist user, fetch their work statistics
  if (profile.role === 'specialist') {
    // Specialist can see demands from dealers in specialist_dealers, or fallback to profile.dealer_id
    const { data: specialistDealers } = await supabase
      .from('specialist_dealers')
      .select('dealer_id')
      .eq('specialist_id', user.id)
    const dealerIds: string[] = (specialistDealers?.length ?? 0) > 0
      ? specialistDealers!.map((sd: { dealer_id: string }) => sd.dealer_id)
      : (profile.dealer_id ? [profile.dealer_id] : [])

    // Get all approved demands for this specialist's dealers (available work)
    let availableWork: { id: string; status: string; appointment_date: string; customer_firstname: string; customer_lastname: string; vehicle_make: string; vehicle_model: string; vehicle_year: number }[] = []
    if (dealerIds.length > 0) {
      const { data } = await supabase
        .from('demands')
        .select('id, status, appointment_date, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year')
        .in('dealer_id', dealerIds)
        .eq('status', 'approved')
        .order('appointment_date', { ascending: true })
      availableWork = data ?? []
    }

    // Get demands assigned to this specialist (with dealer timezone for correct time display)
    const { data: assignedWorkRaw } = await supabase
      .from('demands')
      .select('id, demand_number, status, appointment_date, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, camera_model, customer_address, stock_number, dealers(region_codes(timezone_id, timezones(name)))')
      .eq('assigned_specialist_id', user.id)
      .eq('status', 'approved')
      .order('appointment_date', { ascending: true })
    const assignedWork: AppointmentAlert[] | undefined = assignedWorkRaw?.map((d) => {
      const row = d as Record<string, unknown> & { dealers?: { region_codes?: { timezones?: { name: string } } } | null }
      return {
        ...d,
        id: row.id as string,
        appointment_date: row.appointment_date as string,
        customer_firstname: row.customer_firstname as string,
        customer_lastname: row.customer_lastname as string,
        vehicle_make: row.vehicle_make as string,
        vehicle_model: row.vehicle_model as string,
        vehicle_year: row.vehicle_year as number,
        camera_model: row.camera_model as string,
        customer_address: (row.customer_address as string | null) ?? null,
        stock_number: (row.stock_number as string | null) ?? null,
        timezoneName: row.dealers?.region_codes?.timezones?.name ?? null
      }
    })

    // Get completed demands by this specialist (with dealer timezone for date display)
    const { data: completedWork } = await supabase
      .from('demands')
      .select('id, demand_number, status, updated_at, created_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, camera_model, appointment_date, dealers(region_codes(timezone_id, timezones(name)))')
      .eq('assigned_specialist_id', user.id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })

    // Get today's appointments (PST - system default timezone)
    const { start: todayStart, end: todayEnd } = getTodayRangeInTimezone(SYSTEM_DEFAULT_TIMEZONE)

    let todayAppointments: { id: string; status: string; appointment_date: string; customer_firstname: string; customer_lastname: string; vehicle_make: string; vehicle_model: string; vehicle_year: number; camera_model: string; customer_address: string | null; dealers: unknown }[] = []
    if (dealerIds.length > 0) {
      const { data } = await supabase
        .from('demands')
        .select('id, demand_number, status, appointment_date, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, camera_model, customer_address, dealers(region_codes(timezone_id, timezones(name)))')
        .in('dealer_id', dealerIds)
        .eq('status', 'approved')
        .gte('appointment_date', todayStart)
        .lte('appointment_date', todayEnd)
        .order('appointment_date', { ascending: true })
      todayAppointments = data ?? []
    }

    // Calculate statistics
    const totalAvailable = availableWork?.length || 0
    const myAssigned = assignedWork?.length || 0
    const myCompleted = completedWork?.length || 0
    const todayCount = todayAppointments?.length || 0

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Specialist Dashboard</h1>
          <p className="text-gray-400">Welcome back! Here's an overview of your work.</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Available Work</h3>
            <p className="text-3xl font-bold text-yellow-500">{totalAvailable}</p>
            <p className="text-xs text-gray-500 mt-1">Approved jobs in pool</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">My Assigned</h3>
            <p className="text-3xl font-bold text-blue-500">{myAssigned}</p>
            <p className="text-xs text-gray-500 mt-1">Jobs assigned to me</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Completed</h3>
            <p className="text-3xl font-bold text-green-500">{myCompleted}</p>
            <p className="text-xs text-gray-500 mt-1">Jobs I've completed</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Today's Appointments</h3>
            <p className="text-3xl font-bold text-[#C27E00]">{todayCount}</p>
            <p className="text-xs text-gray-500 mt-1">Scheduled for today</p>
          </div>
        </div>

        {/* Appointment Alerts */}
        {assignedWork && assignedWork.length > 0 && (
          <AppointmentAlerts appointments={assignedWork} />
        )}

        {/* Today's Appointments */}
        {todayCount > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Today's Appointments</h2>
              <Link 
                href="/dashboard/specialist/work" 
                className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
              >
                View All Work →
              </Link>
            </div>
            
            <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
              <ul className="divide-y divide-gray-800">
                {todayAppointments?.slice(0, 5).map(demand => (
                  <li key={demand.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-white">
                            {demand.customer_firstname} {demand.customer_lastname}
                          </p>
                        </div>
                        <p className="text-sm text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          {demand.camera_model}
                        </p>
                        <p className="text-xs text-[#C27E00] mt-1 font-semibold">
                          {(() => {
                            const dealers = demand.dealers as unknown as { region_codes?: { timezones?: { name: string } } } | { region_codes?: { timezones?: { name: string } } }[] | null
                            const tz = Array.isArray(dealers) ? dealers[0]?.region_codes?.timezones?.name : dealers?.region_codes?.timezones?.name
                            return formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(tz), 'PPP h:mm a')
                          })()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {demand.customer_address || 'No address'}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* My Assigned Work */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">My Assigned Work</h2>
            <Link 
              href="/dashboard/specialist/work" 
              className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
            >
              View All →
            </Link>
          </div>
          
          <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
            {(!assignedWork || assignedWork.length === 0) ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 mb-4">You don't have any assigned work yet.</p>
                <Link 
                  href="/dashboard/specialist/work" 
                  className="inline-flex items-center bg-[#C27E00] text-white px-4 py-2 rounded-md hover:bg-[#a06900] transition-colors"
                >
                  View Available Work
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gray-800">
                {assignedWork.slice(0, 10).map(demand => (
                  <li key={demand.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-white">
                            {demand.customer_firstname} {demand.customer_lastname}
                          </p>
                          {(demand as { demand_number?: number }).demand_number != null && (
                            <span className="text-xs font-medium text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                          )}
                          <span className="px-2 py-1 rounded text-xs font-medium border bg-blue-900/50 text-blue-300 border-blue-800">
                            ASSIGNED
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          {demand.camera_model}
                        </p>
                        <p className="text-xs text-[#C27E00] mt-1 font-semibold">
                          Appointment: {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(demand.timezoneName ?? null), 'PPP h:mm a')}
                        </p>
                        {demand.customer_address && (
                          <p className="text-xs text-gray-500 mt-1">
                            Address: {demand.customer_address}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(demand.timezoneName ?? null), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent Completed Work */}
        {myCompleted > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Recent Completed Work</h2>
              <Link 
                href="/dashboard/specialist/reports" 
                className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
              >
                View Reports →
              </Link>
            </div>
            
            <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
              <ul className="divide-y divide-gray-800">
                {completedWork?.slice(0, 5).map(demand => {
                  const completedDealers = (demand as { dealers?: { region_codes?: { timezones?: { name: string } } } | null }).dealers
                  const completedTz = (Array.isArray(completedDealers) ? completedDealers[0] : completedDealers)?.region_codes?.timezones?.name ?? null
                  const fmt = (d: Date, fmtStr: string) => formatInTimeZone(d, getEffectiveTimezone(completedTz ?? null), fmtStr)
                  return (
                  <li key={demand.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-white">
                            {demand.customer_firstname} {demand.customer_lastname}
                          </p>
                          {(demand as { demand_number?: number }).demand_number != null && (
                            <span className="text-xs font-medium text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                          )}
                          <span className="px-2 py-1 rounded text-xs font-medium border bg-green-900/50 text-green-300 border-green-800">
                            COMPLETED
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          {demand.camera_model}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Completed: {fmt(new Date(demand.updated_at || demand.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {fmt(new Date(demand.appointment_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    )
  }

  // If aurora_manager user, fetch system-wide statistics
  if (profile.role === 'aurora_manager') {
    // Get total dealers count
    const { count: totalDealers } = await supabase
      .from('dealers')
      .select('*', { count: 'exact', head: true })

    // Get total specialists count
    const { count: totalSpecialists } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'specialist')

    // Get all demands for statistics (with dealer timezone for appointment display)
    const { data: allDemands } = await supabase
      .from('demands')
      .select('id, demand_number, status, created_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, camera_model, appointment_date, dealers(region_codes(timezone_id, timezones(name)))')
      .order('created_at', { ascending: false })

    // Calculate demand statistics
    const totalDemands = allDemands?.length || 0
    const pendingFinance = allDemands?.filter(d => d.status === 'pending_finance').length || 0
    const approved = allDemands?.filter(d => d.status === 'approved').length || 0
    const completed = allDemands?.filter(d => d.status === 'completed').length || 0
    const cancelled = allDemands?.filter(d => d.status === 'cancelled').length || 0

    // Get recent demands (last 10)
    const recentDemands = allDemands?.slice(0, 10) || []

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Aurora Manager Dashboard</h1>
          <p className="text-gray-400">System-wide overview of dealers, specialists, and demands.</p>
        </div>

        {/* Main Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Total Dealers</h3>
            <p className="text-3xl font-bold text-white">{totalDealers || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Active dealers in system</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Total Specialists</h3>
            <p className="text-3xl font-bold text-[#C27E00]">{totalSpecialists || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Active specialists</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Total Demands</h3>
            <p className="text-3xl font-bold text-blue-500">{totalDemands}</p>
            <p className="text-xs text-gray-500 mt-1">All time demands</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Completed</h3>
            <p className="text-3xl font-bold text-green-500">{completed}</p>
            <p className="text-xs text-gray-500 mt-1">{totalDemands > 0 ? Math.round((completed / totalDemands) * 100) : 0}% completion rate</p>
          </div>
        </div>

        {/* Demand Status Breakdown */}
        <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Demand Status Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border bg-yellow-900/50 text-yellow-300 border-yellow-800">
              <p className="text-sm font-medium mb-1">PENDING FINANCE</p>
              <p className="text-2xl font-bold">{pendingFinance}</p>
              <p className="text-xs mt-1 opacity-75">
                {totalDemands > 0 ? Math.round((pendingFinance / totalDemands) * 100) : 0}% of total
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-blue-900/50 text-blue-300 border-blue-800">
              <p className="text-sm font-medium mb-1">APPROVED</p>
              <p className="text-2xl font-bold">{approved}</p>
              <p className="text-xs mt-1 opacity-75">
                {totalDemands > 0 ? Math.round((approved / totalDemands) * 100) : 0}% of total
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-green-900/50 text-green-300 border-green-800">
              <p className="text-sm font-medium mb-1">COMPLETED</p>
              <p className="text-2xl font-bold">{completed}</p>
              <p className="text-xs mt-1 opacity-75">
                {totalDemands > 0 ? Math.round((completed / totalDemands) * 100) : 0}% of total
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-red-900/50 text-red-300 border-red-800">
              <p className="text-sm font-medium mb-1">CANCELLED</p>
              <p className="text-2xl font-bold">{cancelled}</p>
              <p className="text-xs mt-1 opacity-75">
                {totalDemands > 0 ? Math.round((cancelled / totalDemands) * 100) : 0}% of total
              </p>
            </div>
          </div>
        </div>

        {/* Recent Demands */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Recent Demands</h2>
            <Link 
              href="/dashboard/admin/demands" 
              className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
            >
              View All →
            </Link>
          </div>
          
          <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
            {recentDemands.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400">No demands found.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-800">
                {recentDemands.map(demand => {
                  const statusColors = {
                    pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                    approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                    completed: 'bg-green-900/50 text-green-300 border-green-800',
                    cancelled: 'bg-red-900/50 text-red-300 border-red-800'
                  }
                  const amDealers = (demand as { dealers?: { region_codes?: { timezones?: { name: string } } } | null }).dealers
                  const amTz = (Array.isArray(amDealers) ? amDealers[0] : amDealers)?.region_codes?.timezones?.name ?? null
                  return (
                    <li key={demand.id} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold text-white">
                              {demand.customer_firstname} {demand.customer_lastname}
                            </p>
                            {(demand as { demand_number?: number }).demand_number != null && (
                              <span className="text-xs font-medium text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                            )}
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-gray-900/50 text-gray-300 border-gray-800'}`}>
                              {demand.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">
                            {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                          </p>
                          <p className="text-sm text-gray-400">
                            Camera: {demand.camera_model}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Appointment: {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(amTz ?? null), 'PPP h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {formatInTimeZone(new Date(demand.created_at), getEffectiveTimezone(amTz ?? null), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    )
  }

  // If general_manager user, fetch dealer-specific statistics
  if (profile.role === 'general_manager' && profile.dealer_id) {
    // Get dealer information and timezone for appointment display
    const { data: dealer } = await supabase
      .from('dealers')
      .select('name, code, region_codes(timezone_id, timezones(name))')
      .eq('id', profile.dealer_id)
      .single()
    const gmTimezoneName: string | null = (dealer?.region_codes as { timezones?: { name: string } } | null)?.timezones?.name ?? null

    // Get all demands for this dealer
    const { data: allDemands } = await supabase
      .from('demands')
      .select('id, status, created_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, camera_model, appointment_date')
      .eq('dealer_id', profile.dealer_id)
      .order('created_at', { ascending: false })

    // Get employees for this dealer
    const { data: employees } = await supabase
      .from('profiles')
      .select('role')
      .eq('dealer_id', profile.dealer_id)

    // Get today's appointments (dealer timezone, fallback PST)
    const { start: gmTodayStart, end: gmTodayEnd } = getTodayRangeInTimezone(getEffectiveTimezone(gmTimezoneName))

    const { data: todayAppointments } = await supabase
      .from('demands')
      .select('id, demand_number, status, appointment_date, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, camera_model')
      .eq('dealer_id', profile.dealer_id)
      .eq('status', 'approved')
      .gte('appointment_date', gmTodayStart)
      .lte('appointment_date', gmTodayEnd)
      .order('appointment_date', { ascending: true })

    // Calculate demand statistics
    const totalDemands = allDemands?.length || 0
    const pendingFinance = allDemands?.filter(d => d.status === 'pending_finance').length || 0
    const approved = allDemands?.filter(d => d.status === 'approved').length || 0
    const completed = allDemands?.filter(d => d.status === 'completed').length || 0
    const cancelled = allDemands?.filter(d => d.status === 'cancelled').length || 0

    // Calculate employee statistics
    const totalEmployees = employees?.length || 0
    const salesCount = employees?.filter(e => e.role === 'sales').length || 0
    const financeCount = employees?.filter(e => e.role === 'finance').length || 0
    const specialistCount = employees?.filter(e => e.role === 'specialist').length || 0
    const todayCount = todayAppointments?.length || 0

    // Get recent demands (last 10)
    const recentDemands = allDemands?.slice(0, 10) || []

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">General Manager Dashboard</h1>
          <p className="text-gray-400">
            {dealer ? `Overview for ${dealer.name} (${dealer.code})` : 'Dealer overview'}
          </p>
        </div>

        {/* Main Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Total Employees</h3>
            <p className="text-3xl font-bold text-white">{totalEmployees}</p>
            <p className="text-xs text-gray-500 mt-1">
              {salesCount} Sales, {financeCount} Finance, {specialistCount} Specialist
            </p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Total Demands</h3>
            <p className="text-3xl font-bold text-blue-500">{totalDemands}</p>
            <p className="text-xs text-gray-500 mt-1">All time demands</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Today's Appointments</h3>
            <p className="text-3xl font-bold text-[#C27E00]">{todayCount}</p>
            <p className="text-xs text-gray-500 mt-1">Scheduled for today</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Completed</h3>
            <p className="text-3xl font-bold text-green-500">{completed}</p>
            <p className="text-xs text-gray-500 mt-1">
              {totalDemands > 0 ? Math.round((completed / totalDemands) * 100) : 0}% completion rate
            </p>
          </div>
        </div>

        {/* Demand Status Breakdown */}
        <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Demand Status Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border bg-yellow-900/50 text-yellow-300 border-yellow-800">
              <p className="text-sm font-medium mb-1">PENDING FINANCE</p>
              <p className="text-2xl font-bold">{pendingFinance}</p>
              <p className="text-xs mt-1 opacity-75">
                {totalDemands > 0 ? Math.round((pendingFinance / totalDemands) * 100) : 0}% of total
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-blue-900/50 text-blue-300 border-blue-800">
              <p className="text-sm font-medium mb-1">APPROVED</p>
              <p className="text-2xl font-bold">{approved}</p>
              <p className="text-xs mt-1 opacity-75">
                {totalDemands > 0 ? Math.round((approved / totalDemands) * 100) : 0}% of total
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-green-900/50 text-green-300 border-green-800">
              <p className="text-sm font-medium mb-1">COMPLETED</p>
              <p className="text-2xl font-bold">{completed}</p>
              <p className="text-xs mt-1 opacity-75">
                {totalDemands > 0 ? Math.round((completed / totalDemands) * 100) : 0}% of total
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-red-900/50 text-red-300 border-red-800">
              <p className="text-sm font-medium mb-1">CANCELLED</p>
              <p className="text-2xl font-bold">{cancelled}</p>
              <p className="text-xs mt-1 opacity-75">
                {totalDemands > 0 ? Math.round((cancelled / totalDemands) * 100) : 0}% of total
              </p>
            </div>
          </div>
        </div>

        {/* Today's Appointments */}
        {todayCount > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Today's Appointments</h2>
              <Link 
                href="/dashboard/admin/demands" 
                className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
              >
                View All Demands →
              </Link>
            </div>
            
            <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
              <ul className="divide-y divide-gray-800">
                {todayAppointments?.slice(0, 5).map(demand => (
                  <li key={demand.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-white">
                            {demand.customer_firstname} {demand.customer_lastname}
                          </p>
                          {(demand as { demand_number?: number }).demand_number != null && (
                            <span className="text-xs font-medium text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          {demand.camera_model}
                        </p>
                        <p className="text-xs text-[#C27E00] mt-1 font-semibold">
                          {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(gmTimezoneName ?? null), 'PPP h:mm a')}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Recent Demands */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Recent Demands</h2>
            <Link 
              href="/dashboard/admin/demands" 
              className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
            >
              View All →
            </Link>
          </div>
          
          <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
            {recentDemands.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400">No demands found for your dealer.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-800">
                {recentDemands.map(demand => {
                  const statusColors = {
                    pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                    approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                    completed: 'bg-green-900/50 text-green-300 border-green-800',
                    cancelled: 'bg-red-900/50 text-red-300 border-red-800'
                  }
                  return (
                    <li key={demand.id} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold text-white">
                              {demand.customer_firstname} {demand.customer_lastname}
                            </p>
                            {(demand as { demand_number?: number }).demand_number != null && (
                              <span className="text-xs font-medium text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                            )}
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-gray-900/50 text-gray-300 border-gray-800'}`}>
                              {demand.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">
                            {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                          </p>
                          <p className="text-sm text-gray-400">
                            Camera: {demand.camera_model}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Appointment: {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(gmTimezoneName ?? null), 'PPP h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {formatInTimeZone(new Date(demand.created_at), getEffectiveTimezone(gmTimezoneName ?? null), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    )
  }

  // For other roles, show default dashboard
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
      <p className="mt-4 text-gray-400">Welcome to AuroraHub. Select an option from the sidebar to get started.</p>
    </div>
  )
}

