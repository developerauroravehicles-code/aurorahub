import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import Link from 'next/link'
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, Calendar, Briefcase, ClipboardCheck, Users, DollarSign, Building2, BarChart3 } from 'lucide-react'
import { AppointmentAlerts, type AppointmentAlert } from './specialist/appointment-alerts'
import { getEffectiveTimezone, getTodayRangeInTimezone, SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { GMDashboardMonthSelector } from './gm-dashboard-month-selector'
import {
  StatCard,
  WelcomeBanner,
  DataCard,
  QuickActions,
  CameraDistribution,
  InventoryStockAlertsWidget,
} from '@/components/dashboard'

function getCameraDistribution(demands: { camera_model?: string | null }[]): { model: string; count: number }[] {
  const map = new Map<string, number>()
  for (const d of demands) {
    const model = d.camera_model?.trim() || 'Unknown'
    map.set(model, (map.get(model) ?? 0) + 1)
  }
  return Array.from(map.entries()).map(([model, count]) => ({ model, count }))
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; financeMonth?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // Get user profile to determine role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, dealer_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) return <div className="text-zinc-900 dark:text-white">Profile not found</div>

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
      <div className="space-y-10">
        <WelcomeBanner
          title="Sales Dashboard"
          subtitle="Overview of your demands"
          userName={(profile as { full_name?: string })?.full_name?.split(' ')[0]}
          timezone={salesTimezoneName}
          userId={user.id}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Total Demands" value={totalDemands} icon={FileText} accentColor="white" />
          <StatCard title="Pending Finance" value={pendingFinance} icon={AlertCircle} accentColor="yellow" />
          <StatCard title="Approved" value={approved} icon={Clock} accentColor="blue" />
          <StatCard title="Completed" value={completed} icon={CheckCircle} accentColor="green" />
          <StatCard title="Cancelled" value={cancelled} icon={XCircle} accentColor="red" />
        </div>

        {(demands?.length ?? 0) > 0 && (
          <CameraDistribution items={getCameraDistribution(demands ?? [])} />
        )}

        <DataCard
          title="Your Demands"
          action={{ label: 'View All', href: '/dashboard/sales/demands' }}
        >
          {(!demands || demands.length === 0) ? (
              <div className="py-12 text-center">
                <p className="text-zinc-500 dark:text-gray-400 mb-5">You haven't created any demands yet.</p>
                <Link
                  href="/dashboard/sales/demands/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#C27E00] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#a06900] hover:shadow-[#C27E00]/25"
                >
                  Create Your First Demand
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-gray-800/80">
                {demands.slice(0, 10).map(demand => {
                  const statusColors: Record<string, string> = {
                    pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                    approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                    completed: 'bg-green-900/50 text-green-300 border-green-800',
                    cancelled: 'bg-red-900/50 text-red-300 border-red-800'
                  }
                  return (
                    <li key={demand.id} className="px-6 py-4 hover:bg-white/[0.03] transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold text-zinc-900 dark:text-white">
                              {demand.customer_firstname} {demand.customer_lastname}
                            </p>
                            {(demand as { demand_number?: number }).demand_number != null && (
                              <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                            )}
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-zinc-200/80 dark:bg-gray-900/50 text-zinc-600 dark:text-gray-300 border-zinc-200 dark:border-gray-800'}`}>
                              {demand.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-500 dark:text-gray-400">
                            {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">
                            Appointment: {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(salesTimezoneName), 'PPP h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-zinc-500 dark:text-gray-500">
                            {formatInTimeZone(new Date(demand.created_at), getEffectiveTimezone(salesTimezoneName), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
        </DataCard>
      </div>
    )
  }

  // If finance user, fetch their statistics (only from their dealer)
  if (profile.role === 'finance') {
    const dealerId = profile.dealer_id

    // Dealer timezone for WelcomeBanner (finance at dealer uses dealer TZ; otherwise PT)
    let financeTimezoneName: string | null = null
    if (dealerId) {
      const { data: financeDealer } = await supabase
        .from('dealers')
        .select('region_codes(timezone_id, timezones(name))')
        .eq('id', dealerId)
        .single()
      financeTimezoneName = (financeDealer?.region_codes as { timezones?: { name: string } } | null)?.timezones?.name ?? null
    }

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
      <div className="space-y-10">
        <WelcomeBanner
          title="Finance Dashboard"
          subtitle="Overview of demands and assignments"
          userName={(profile as { full_name?: string })?.full_name?.split(' ')[0]}
          timezone={financeTimezoneName ?? SYSTEM_DEFAULT_TIMEZONE}
          userId={user.id}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Pending" value={totalPending} subtitle="In demand pool" icon={AlertCircle} accentColor="yellow" />
          <StatCard title="My Assigned" value={myAssigned} subtitle={`${myPending} pending, ${myApproved} approved`} icon={FileText} accentColor="blue" />
          <StatCard title="Total Approved" value={totalApproved} icon={Clock} accentColor="green" />
          <StatCard title="Total Completed" value={totalCompleted} icon={CheckCircle} accentColor="emerald" />
        </div>

        <DataCard title="My Assigned Demands" action={{ label: 'View All', href: '/dashboard/finance/demands' }}>
          {(!assignedDemands || assignedDemands.length === 0) ? (
            <div className="py-12 text-center">
              <p className="text-zinc-500 dark:text-gray-400 mb-5">You haven't assigned any demands yet.</p>
              <Link
                href="/dashboard/finance/demands"
                className="inline-flex items-center gap-2 rounded-xl bg-[#C27E00] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#a06900] hover:shadow-[#C27E00]/25"
              >
                View Demand Pool
              </Link>
            </div>
          ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-gray-800/80">
                {assignedDemands.slice(0, 10).map(demand => {
                  const statusColors = {
                    pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                    approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                    completed: 'bg-green-900/50 text-green-300 border-green-800',
                    cancelled: 'bg-red-900/50 text-red-300 border-red-800'
                  }
                  
                  return (
                    <li key={demand.id} className="px-6 py-4 hover:bg-white/[0.03] transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold text-zinc-900 dark:text-white">
                              {demand.customer_firstname} {demand.customer_lastname}
                            </p>
                            {(demand as { demand_number?: number }).demand_number != null && (
                              <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                            )}
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-zinc-200/80 dark:bg-gray-900/50 text-zinc-600 dark:text-gray-300 border-zinc-200 dark:border-gray-800'}`}>
                              {demand.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-500 dark:text-gray-400">
                            {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">
                            Appointment: {(() => {
                              const dealers = (demand as { dealers?: { region_codes?: { timezones?: { name: string } } } | null }).dealers
                              const tz = dealers?.region_codes?.timezones?.name ?? null
                              return formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(tz), 'PPP h:mm a')
                            })()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-zinc-500 dark:text-gray-500">
                            {formatInTimeZone(new Date(demand.created_at), getEffectiveTimezone((demand as { dealers?: { region_codes?: { timezones?: { name: string } } } | null }).dealers?.region_codes?.timezones?.name ?? null), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
          )}
        </DataCard>
      </div>
    )
  }

  // If specialist user, fetch their work statistics
  if (profile.role === 'specialist') {
    // Specialist can see demands from dealers in specialist_dealers, or fallback to profile.dealer_id
    const { data: specialistDealers } = await supabase
      .from('specialist_dealers')
      .select('dealer_id, dealers(name)')
      .eq('specialist_id', user.id)
    const dealerIds: string[] = (specialistDealers?.length ?? 0) > 0
      ? specialistDealers!.map((sd: { dealer_id: string }) => sd.dealer_id)
      : (profile.dealer_id ? [profile.dealer_id] : [])
    let dealerNames: string[] = (specialistDealers ?? []).map((sd: { dealers?: { name: string } | { name: string }[] }) => {
      const d = sd.dealers
      return (Array.isArray(d) ? d[0]?.name : (d as { name?: string })?.name) ?? null
    }).filter((n): n is string => Boolean(n))
    if (dealerIds.length > 0 && dealerNames.length === 0) {
      const { data: dealersData } = await supabase.from('dealers').select('name').in('id', dealerIds)
      dealerNames = dealersData?.map(d => d.name) ?? []
    }

    // Get all demands from specialist's dealers (for status breakdown + camera distribution)
    let allScopeDemands: { id: string; status: string; camera_model?: string | null }[] = []
    if (dealerIds.length > 0) {
      const { data } = await supabase.from('demands').select('id, status, camera_model').in('dealer_id', dealerIds)
      allScopeDemands = data ?? []
    }

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

    // Get today's appointments (PT - system default timezone)
    const { start: todayStart, end: todayEnd } = getTodayRangeInTimezone(SYSTEM_DEFAULT_TIMEZONE)
    const now = new Date()
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndISO = weekEnd.toISOString()

    let todayAppointments: { id: string; status: string; appointment_date: string; customer_firstname: string; customer_lastname: string; vehicle_make: string; vehicle_model: string; vehicle_year: number; camera_model: string; customer_address: string | null; dealers: unknown }[] = []
    let upcomingThisWeek: typeof todayAppointments = []
    if (dealerIds.length > 0) {
      const { data: todayData } = await supabase
        .from('demands')
        .select('id, demand_number, status, appointment_date, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, camera_model, customer_address, dealers(region_codes(timezone_id, timezones(name)))')
        .in('dealer_id', dealerIds)
        .eq('status', 'approved')
        .or('is_external.is.null,is_external.eq.false')
        .gte('appointment_date', todayStart)
        .lte('appointment_date', todayEnd)
        .order('appointment_date', { ascending: true })
      todayAppointments = todayData ?? []
      const { data: weekData } = await supabase
        .from('demands')
        .select('id, demand_number, status, appointment_date, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, camera_model, customer_address, dealers(region_codes(timezone_id, timezones(name)))')
        .in('dealer_id', dealerIds)
        .eq('status', 'approved')
        .or('is_external.is.null,is_external.eq.false')
        .gt('appointment_date', todayEnd)
        .lte('appointment_date', weekEndISO)
        .order('appointment_date', { ascending: true })
      upcomingThisWeek = weekData ?? []
    }

    // Calculate statistics
    const totalAvailable = availableWork?.length || 0
    const myAssigned = assignedWork?.length || 0
    const myCompleted = completedWork?.length || 0
    const todayCount = todayAppointments?.length || 0
    const upcomingCount = upcomingThisWeek?.length || 0
    const totalScope = allScopeDemands?.length || 0
    const pendingFinance = allScopeDemands?.filter(d => d.status === 'pending_finance').length || 0
    const approvedScope = allScopeDemands?.filter(d => d.status === 'approved').length || 0
    const completedScope = allScopeDemands?.filter(d => d.status === 'completed').length || 0
    const cancelledScope = allScopeDemands?.filter(d => d.status === 'cancelled').length || 0
    const completionRate = myAssigned + myCompleted > 0 ? Math.round((myCompleted / (myAssigned + myCompleted)) * 100) : 0

    return (
      <div className="space-y-10">
        <WelcomeBanner
          title="Technical Support Dashboard"
          subtitle="Work assignments, job pool, appointments, and performance overview for your dealers"
          userName={(profile as { full_name?: string })?.full_name?.split(' ')[0]}
          timezone={SYSTEM_DEFAULT_TIMEZONE}
          userId={user.id}
        />

        <QuickActions
          actions={[
            { label: 'Work List', href: '/dashboard/specialist/work', icon: FileText },
            { label: 'Reports', href: '/dashboard/specialist/reports', icon: BarChart3 },
          ]}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="Dealers" value={dealerIds.length || 0} subtitle={dealerNames.slice(0, 2).join(', ') || (dealerIds.length ? 'Assigned dealers' : 'No dealers')} icon={Building2} accentColor="white" />
          <StatCard title="Available Work" value={totalAvailable} subtitle="Approved jobs in pool" icon={Briefcase} accentColor="yellow" />
          <StatCard title="My Assigned" value={myAssigned} subtitle="Jobs assigned to me" icon={ClipboardCheck} accentColor="blue" />
          <StatCard title="Completed" value={myCompleted} subtitle={completionRate > 0 ? `${completionRate}% completion rate` : "Jobs I've completed"} icon={CheckCircle} accentColor="green" />
          <StatCard title="Today's Appointments" value={todayCount} subtitle="Scheduled for today" icon={Calendar} accentColor="orange" />
          <StatCard title="Upcoming This Week" value={upcomingCount} subtitle="Next 7 days" icon={Clock} accentColor="white" />
        </div>

        {/* Status Breakdown - scope: demands from specialist's dealers */}
        {totalScope > 0 && (
          <div className="rounded-xl border border-zinc-200 dark:border-gray-800/80 bg-gradient-to-b from-white/[0.04] to-transparent overflow-hidden p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-5">Demand Status (Your Dealers)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border bg-yellow-900/50 text-yellow-300 border-yellow-800">
                <p className="text-sm font-medium mb-1">PENDING FINANCE</p>
                <p className="text-2xl font-bold">{pendingFinance}</p>
                <p className="text-xs mt-1 opacity-75">{totalScope > 0 ? Math.round((pendingFinance / totalScope) * 100) : 0}% of total</p>
              </div>
              <div className="p-4 rounded-lg border bg-blue-900/50 text-blue-300 border-blue-800">
                <p className="text-sm font-medium mb-1">APPROVED</p>
                <p className="text-2xl font-bold">{approvedScope}</p>
                <p className="text-xs mt-1 opacity-75">{totalScope > 0 ? Math.round((approvedScope / totalScope) * 100) : 0}% of total</p>
              </div>
              <div className="p-4 rounded-lg border bg-green-900/50 text-green-300 border-green-800">
                <p className="text-sm font-medium mb-1">COMPLETED</p>
                <p className="text-2xl font-bold">{completedScope}</p>
                <p className="text-xs mt-1 opacity-75">{totalScope > 0 ? Math.round((completedScope / totalScope) * 100) : 0}% of total</p>
              </div>
              <div className="p-4 rounded-lg border bg-red-900/50 text-red-300 border-red-800">
                <p className="text-sm font-medium mb-1">CANCELLED</p>
                <p className="text-2xl font-bold">{cancelledScope}</p>
                <p className="text-xs mt-1 opacity-75">{totalScope > 0 ? Math.round((cancelledScope / totalScope) * 100) : 0}% of total</p>
              </div>
            </div>
          </div>
        )}

        {/* Camera Distribution - scope: approved + completed from specialist's dealers */}
        <CameraDistribution items={getCameraDistribution(allScopeDemands.filter(d => ['approved', 'completed'].includes(d.status)))} />

        {/* Appointment Alerts */}
        {assignedWork && assignedWork.length > 0 && (
          <AppointmentAlerts appointments={assignedWork} />
        )}

        {/* Today's Appointments */}
        {todayCount > 0 && (
          <DataCard title="Today's Appointments" action={{ label: 'View All Work', href: '/dashboard/specialist/work' }}>
              <ul className="divide-y divide-zinc-200 dark:divide-gray-800/80">
                {todayAppointments?.slice(0, 5).map(demand => (
                  <li key={demand.id} className="px-6 py-4 hover:bg-white/[0.03] transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            {demand.customer_firstname} {demand.customer_lastname}
                          </p>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">
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
                        <p className="text-xs text-zinc-500 dark:text-gray-500">
                          {demand.customer_address || 'No address'}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
          </DataCard>
        )}

        <DataCard title="My Assigned Work" action={{ label: 'View All', href: '/dashboard/specialist/work' }}>
            {(!assignedWork || assignedWork.length === 0) ? (
              <div className="py-12 text-center">
                <p className="text-zinc-500 dark:text-gray-400 mb-5">You don't have any assigned work yet.</p>
                <Link
                  href="/dashboard/specialist/work"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#C27E00] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#a06900] hover:shadow-[#C27E00]/25"
                >
                  View Available Work
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-gray-800/80">
                {assignedWork.slice(0, 10).map(demand => (
                  <li key={demand.id} className="px-6 py-4 hover:bg-white/[0.03] transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            {demand.customer_firstname} {demand.customer_lastname}
                          </p>
                          {(demand as { demand_number?: number }).demand_number != null && (
                            <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                          )}
                          <span className="px-2 py-1 rounded text-xs font-medium border bg-blue-900/50 text-blue-300 border-blue-800">
                            ASSIGNED
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">
                          {demand.camera_model}
                        </p>
                        <p className="text-xs text-[#C27E00] mt-1 font-semibold">
                          Appointment: {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(demand.timezoneName ?? null), 'PPP h:mm a')}
                        </p>
                        {demand.customer_address && (
                          <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">
                            Address: {demand.customer_address}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 dark:text-gray-500">
                          {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(demand.timezoneName ?? null), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </DataCard>

        {/* Recent Completed Work */}
        {myCompleted > 0 && (
          <DataCard title="Recent Completed Work" action={{ label: 'View Reports', href: '/dashboard/specialist/reports' }}>
              <ul className="divide-y divide-zinc-200 dark:divide-gray-800/80">
                {completedWork?.slice(0, 5).map(demand => {
                  const completedDealers = (demand as { dealers?: { region_codes?: { timezones?: { name: string } } } | null }).dealers
                  const completedTz = (Array.isArray(completedDealers) ? completedDealers[0] : completedDealers)?.region_codes?.timezones?.name ?? null
                  const fmt = (d: Date, fmtStr: string) => formatInTimeZone(d, getEffectiveTimezone(completedTz ?? null), fmtStr)
                  return (
                  <li key={demand.id} className="px-6 py-4 hover:bg-white/[0.03] transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            {demand.customer_firstname} {demand.customer_lastname}
                          </p>
                          {(demand as { demand_number?: number }).demand_number != null && (
                            <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                          )}
                          <span className="px-2 py-1 rounded text-xs font-medium border bg-green-900/50 text-green-300 border-green-800">
                            COMPLETED
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">
                          {demand.camera_model}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">
                          Completed: {fmt(new Date(demand.updated_at || demand.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 dark:text-gray-500">
                          {fmt(new Date(demand.appointment_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  </li>
                  )
                })}
              </ul>
          </DataCard>
        )}
      </div>
    )
  }

  // HR role: dedicated HR dashboard (platform users only)
  if (profile.role === 'hr') {
    const { count: totalPersonnel } = await supabase.from('personnel').select('*', { count: 'exact', head: true })
    const { data: platformEmployees } = await supabase
      .from('profiles')
      .select('role')
      .is('dealer_id', null)
    const employeeCounts = {
      specialist: platformEmployees?.filter(e => e.role === 'specialist').length || 0,
      aurora_manager: platformEmployees?.filter(e => e.role === 'aurora_manager').length || 0,
      hr: platformEmployees?.filter(e => e.role === 'hr').length || 0,
      it: platformEmployees?.filter(e => e.role === 'it').length || 0,
    }
    const totalEmployees = platformEmployees?.length || 0

    const { data: platformProfiles } = await supabase
      .from('profiles')
      .select('id')
      .is('dealer_id', null)
    const platformIds = platformProfiles?.map(p => p.id) ?? []

    const { count: pendingLeave } = platformIds.length > 0
      ? await supabase
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .in('profile_id', platformIds)
      : { count: 0 }

    const { count: openPositions } = await supabase
      .from('recruitment_positions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'interviewing', 'offer'])
      .is('dealer_id', null)

    const { data: incompleteTasks } = await supabase
      .from('onboarding_tasks')
      .select('profile_id')
      .neq('status', 'completed')
    const onboardingInProgress = platformIds.length > 0 && (incompleteTasks?.length ?? 0) > 0
      ? (incompleteTasks?.filter((t: { profile_id: string }) => platformIds.includes(t.profile_id)).length ?? 0)
      : 0

    return (
      <div className="space-y-10">
        <WelcomeBanner
          title="HR Dashboard"
          subtitle="Employee management, leave, recruitment, and onboarding overview"
          userName={(profile as { full_name?: string })?.full_name?.split(' ')[0]}
          timezone={SYSTEM_DEFAULT_TIMEZONE}
          userId={user.id}
        />

        <QuickActions
          actions={[
            { label: 'Personnel Registry', href: '/dashboard/hr/personnel' },
            { label: 'Installer Network', href: '/dashboard/hr/installers' },
            { label: 'Employees', href: '/dashboard/hr/employees' },
            { label: 'Leave', href: '/dashboard/hr/leave' },
            { label: 'Recruitment', href: '/dashboard/hr/recruitment' },
            { label: 'Onboarding', href: '/dashboard/hr/onboarding' },
            { label: 'Analytics', href: '/dashboard/hr/analytics' },
          ]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Total Personnel" value={totalPersonnel ?? 0} subtitle="All worker types" accentColor="white" />
          <StatCard title="Platform Employees" value={totalEmployees} subtitle={`${employeeCounts.specialist} Technical Support, ${employeeCounts.aurora_manager} Aurora Manager, ${employeeCounts.hr} HR, ${employeeCounts.it} IT`} accentColor="white" />
          <StatCard title="Pending Leave" value={pendingLeave ?? 0} subtitle="Awaiting approval" accentColor="yellow" />
          <StatCard title="Open Positions" value={openPositions ?? 0} subtitle="Active recruitment" accentColor="blue" />
          <StatCard title="Onboarding Tasks" value={onboardingInProgress ?? 0} subtitle="In progress" accentColor="orange" />
        </div>
      </div>
    )
  }

  // IT role: dedicated IT Dashboard
  if (profile.role === 'it') {
    const admin = (await import('@/lib/supabase/admin')).createAdminClient()

    const [ticketsRes, incidentsRes, slaBreachRes, myTicketsRes, profilesRes, smsLogsRes, mailLogsRes, recentAlertsRes] = await Promise.all([
      admin.from('it_tickets').select('id, ticket_number, title, status, priority, sla_due_at'),
      admin.from('it_incidents').select('id, incident_number, title, severity, status'),
      admin.from('it_tickets').select('id').not('sla_due_at', 'is', null).not('status', 'in', '("resolved","closed")').lt('sla_due_at', new Date().toISOString()),
      admin.from('it_tickets').select('id, ticket_number, title, priority, status, created_at').eq('assigned_to', user.id).not('status', 'in', '("resolved","closed")').order('created_at', { ascending: false }).limit(10),
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('sms_logs').select('id', { count: 'exact', head: true }),
      admin.from('mail_logs').select('id', { count: 'exact', head: true }),
      admin.from('alert_logs').select('id, alert_type, subject, success, created_at').order('created_at', { ascending: false }).limit(5),
    ])

    const tickets = ticketsRes.data ?? []
    const incidents = incidentsRes.data ?? []
    const slaBreachCount = slaBreachRes.data?.length ?? 0
    const myTickets = myTicketsRes.data ?? []
    const openTickets = tickets.filter((t: { status: string }) => !['resolved', 'closed'].includes(t.status))
    const criticalTickets = tickets.filter((t: { priority: string; status: string }) => t.priority === 'critical' && !['resolved', 'closed'].includes(t.status))
    const criticalIncidents = incidents.filter((i: { severity: string; status: string }) => i.severity === 'critical' && !['resolved', 'closed'].includes(i.status))
    const recentAlerts = recentAlertsRes.data ?? []

    return (
      <div className="space-y-10">
        <WelcomeBanner
          title="IT Dashboard"
          subtitle="Service desk, incidents, system health, and observability overview"
          userName={(profile as { full_name?: string })?.full_name?.split(' ')[0]}
          timezone={SYSTEM_DEFAULT_TIMEZONE}
          userId={user.id}
        />

        <QuickActions
          actions={[
            { label: 'Service Desk', href: '/dashboard/operations/service-desk' },
            { label: 'Logs', href: '/dashboard/observability/logs' },
            { label: 'Monitoring', href: '/dashboard/observability/monitoring' },
            { label: 'Alerts', href: '/dashboard/observability/alerts' },
            { label: 'Identity', href: '/dashboard/identity' },
            { label: 'Infrastructure', href: '/dashboard/infrastructure/database' },
            { label: 'Integrations', href: '/dashboard/integrations/webhooks' },
            { label: 'Configuration', href: '/dashboard/configuration/settings' },
          ]}
        />

        {/* IT Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Link href="/dashboard/operations/service-desk?tab=tickets" className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg hover:bg-zinc-200 dark:bg-white/10 transition-colors">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-2">Open Tickets</h3>
            <p className="text-3xl font-bold text-zinc-900 dark:text-white">{openTickets.length}</p>
            <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Active tickets</p>
          </Link>
          <Link href="/dashboard/operations/service-desk?tab=tickets" className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg hover:bg-zinc-200 dark:bg-white/10 transition-colors">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-2">Critical Tickets</h3>
            <p className="text-3xl font-bold text-red-500">{criticalTickets.length}</p>
            <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Requires attention</p>
          </Link>
          <Link href="/dashboard/operations/service-desk?tab=tickets" className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg hover:bg-zinc-200 dark:bg-white/10 transition-colors">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-2">SLA Breaches</h3>
            <p className="text-3xl font-bold text-amber-500">{slaBreachCount}</p>
            <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Past due</p>
          </Link>
          <Link href="/dashboard/operations/service-desk?tab=incidents" className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg hover:bg-zinc-200 dark:bg-white/10 transition-colors">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-2">Critical Incidents</h3>
            <p className="text-3xl font-bold text-red-500">{criticalIncidents.length}</p>
            <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Open critical</p>
          </Link>
          <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-2">My Assigned</h3>
            <p className="text-3xl font-bold text-blue-500">{myTickets.length}</p>
            <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Tickets assigned to me</p>
          </div>
        </div>

        {/* System Health */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link href="/dashboard/identity/users" className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-4 rounded-lg hover:bg-zinc-200 dark:bg-white/10 transition-colors">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-1">Users</h3>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">{profilesRes.count ?? 0}</p>
          </Link>
          <Link href="/dashboard/observability/logs?type=sms" className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-4 rounded-lg hover:bg-zinc-200 dark:bg-white/10 transition-colors">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-1">SMS Sent</h3>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">{smsLogsRes.count ?? 0}</p>
          </Link>
          <Link href="/dashboard/observability/logs?type=mail" className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-4 rounded-lg hover:bg-zinc-200 dark:bg-white/10 transition-colors">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-1">Emails Sent</h3>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">{mailLogsRes.count ?? 0}</p>
          </Link>
          <div className="bg-zinc-200/50 dark:bg-white/5 border border-green-900/30 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-1">Database</h3>
            <p className="text-2xl font-bold text-green-500">Healthy</p>
          </div>
        </div>

        {/* My Assigned Tickets & Recent Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">My Assigned Tickets</h2>
              <Link href="/dashboard/operations/service-desk?tab=tickets" className="text-sm text-[#C27E00] hover:underline">View All →</Link>
            </div>
            {myTickets.length === 0 ? (
              <p className="text-zinc-500 dark:text-gray-500">No tickets assigned to you.</p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-gray-800 space-y-0">
                {myTickets.slice(0, 5).map((t: { id: string; ticket_number: string; title: string; priority: string; status: string }) => (
                  <li key={t.id} className="py-3">
                    <Link href="/dashboard/operations/service-desk?tab=tickets" className="block hover:bg-zinc-200/50 dark:bg-white/5 -mx-2 px-2 py-1 rounded">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-zinc-900 dark:text-white">{t.ticket_number}: {t.title}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${t.priority === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-zinc-500 dark:text-gray-400'}`}>{t.priority}</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-gray-500 mt-0.5">{t.status}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Recent Alerts</h2>
              <Link href="/dashboard/observability/alerts" className="text-sm text-[#C27E00] hover:underline">Configure →</Link>
            </div>
            {recentAlerts.length === 0 ? (
              <p className="text-zinc-500 dark:text-gray-500">No recent alerts.</p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-gray-800 space-y-0">
                {recentAlerts.map((a: { id: string; alert_type: string; subject: string | null; success: boolean; created_at: string }) => (
                  <li key={a.id} className="py-3 flex justify-between items-start">
                    <div>
                      <p className="text-sm text-zinc-900 dark:text-white truncate max-w-[200px]">{a.subject ?? a.alert_type}</p>
                      <p className="text-xs text-zinc-500 dark:text-gray-500">{formatInTimeZone(new Date(a.created_at), SYSTEM_DEFAULT_TIMEZONE, 'MMM d, yyyy h:mm a')}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${a.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{a.success ? 'Sent' : 'Failed'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Aurora Manager: platform admin dashboard
  if (profile.role === 'aurora_manager') {
    const params = await searchParams
    const { getDashboardOverviewData } = await import('./admin/dashboard/actions')
    const { fetchInventoryStockAlerts } = await import('@/lib/inventory-stock-alerts')

    const [dealersCountRes, specialistsCountRes, cameraRowsRes, recentDemandsRes, overviewData, inventoryStock] =
      await Promise.all([
        supabase.from('dealers').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'specialist'),
        supabase.from('demands').select('camera_model'),
        supabase
          .from('demands')
          .select(
            'id, demand_number, status, created_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, camera_model, appointment_date'
          )
          .order('created_at', { ascending: false })
          .limit(10),
        getDashboardOverviewData(params.financeMonth ?? null),
        fetchInventoryStockAlerts(supabase),
      ])

    const totalDealers = dealersCountRes.count
    const totalSpecialists = specialistsCountRes.count
    const recentDemands = recentDemandsRes.data ?? []
    const completed = overviewData.demandCounts.completed
    const totalDemands =
      overviewData.demandCounts.pending_finance +
      overviewData.demandCounts.approved +
      completed +
      overviewData.demandCounts.cancelled

    const { DemandOverview } = await import('./admin/dashboard/demand-overview')
    const { DemandTrends } = await import('./admin/dashboard/demand-trends')
    const { InvoiceOverview } = await import('./admin/dashboard/invoice-overview')
    const { StatementOverview } = await import('./admin/dashboard/statement-overview')
    const { FinanceOverview } = await import('./admin/dashboard/finance-overview')
    const { EmployeeOverview } = await import('./admin/dashboard/employee-overview')
    const { DealerAlertsWidget } = await import('./admin/dashboard/dealer-alerts')
    const { ManagerNotesWidget } = await import('./admin/dashboard/manager-notes')

    return (
      <div className="space-y-10">
        <WelcomeBanner
          title="Aurora Manager Dashboard"
          subtitle="Demands, finance, employees, dealer alerts, and inventory stock alerts"
          userName={(profile as { full_name?: string })?.full_name?.split(' ')[0]}
          timezone={SYSTEM_DEFAULT_TIMEZONE}
          userId={user.id}
        />

        <QuickActions
          actions={[
            { label: 'Demand Tracking', href: '/dashboard/admin/demands' },
            { label: 'Invoice', href: '/dashboard/admin/invoices' },
            { label: 'Finance', href: '#finance-overview' },
            { label: 'Statement Tracking', href: '/dashboard/admin/statements' },
            { label: 'Employee Tracking', href: '/dashboard/admin/employees' },
            { label: 'Inventory', href: '/dashboard/admin/inventory' },
            { label: 'Stock alerts', href: '#inventory-stock-alerts' },
            { label: 'Dealer Alerts', href: '#dealer-alerts' },
            { label: 'Notes & Reminders', href: '#manager-notes' },
          ]}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Dealers" value={totalDealers || 0} subtitle="Active dealers in system" icon={Users} accentColor="white" />
          <StatCard title="Technical Support" value={totalSpecialists || 0} subtitle="Active specialists" icon={Briefcase} accentColor="orange" />
          <StatCard title="Total Demands" value={totalDemands} subtitle="All time demands" icon={FileText} accentColor="blue" />
          <StatCard title="Completed" value={completed} subtitle={totalDemands > 0 ? `${Math.round((completed / totalDemands) * 100)}% completion rate` : undefined} icon={CheckCircle} accentColor="green" />
        </div>

        <InventoryStockAlertsWidget alerts={inventoryStock.alerts} summary={inventoryStock.summary} />

        <CameraDistribution items={getCameraDistribution(cameraRowsRes.data ?? [])} />

        {/* Demand Overview with Pie Chart */}
        <div id="demand-overview">
          <DemandOverview
            counts={overviewData.demandCounts}
            recentDemands={recentDemands.map(d => ({
              id: d.id,
              demand_number: (d as { demand_number?: number }).demand_number,
              customer_firstname: d.customer_firstname,
              customer_lastname: d.customer_lastname,
              status: d.status
            }))}
          />
        </div>

        {/* Demand Analytics - Monthly Trend & Dealer Comparison */}
        <DemandTrends monthlyTrend={overviewData.monthlyTrend} dealerDemands={overviewData.dealerDemands} />

        {/* Invoice / Statement / Employee Overviews */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InvoiceOverview summary={overviewData.invoiceSummary} />
          <StatementOverview summary={overviewData.statementSummary} />
          <EmployeeOverview counts={overviewData.employeeRoleCounts} />
        </div>

        {/* Finance Overview */}
        <div id="finance-overview">
          <FinanceOverview summary={overviewData.financeSummary} selectedMonth={params.financeMonth ?? ''} />
        </div>

        {/* Dealer Alerts & Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div id="dealer-alerts">
            <DealerAlertsWidget />
          </div>
          <div id="manager-notes">
            <ManagerNotesWidget />
          </div>
        </div>
      </div>
    )
  }

  // If inventory_manager user, fetch dealer-specific overview
  if (profile.role === 'inventory_manager') {
    if (!profile.dealer_id) {
      return (
        <div className="space-y-10">
          <WelcomeBanner
            title="Inventory Manager Dashboard"
            subtitle="Demands and customer directory"
            userName={(profile as { full_name?: string })?.full_name?.split(' ')[0]}
            timezone={SYSTEM_DEFAULT_TIMEZONE}
            userId={user.id}
          />
          <div className="rounded-lg border border-amber-800/60 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
            No dealer is assigned to your account. Contact IT to link you to a dealer before viewing or editing demands.
          </div>
          <QuickActions
            actions={[
              { label: 'Demands', href: '/dashboard/admin/demands' },
              { label: 'Customers', href: '/dashboard/admin/customers' },
            ]}
          />
        </div>
      )
    }

    const { data: dealer } = await supabase
      .from('dealers')
      .select('name, code, region_codes(timezone_id, timezones(name))')
      .eq('id', profile.dealer_id)
      .single()
    const imTimezoneName: string | null = (dealer?.region_codes as { timezones?: { name: string } } | null)?.timezones?.name ?? null

    const { data: allDemands } = await supabase
      .from('demands')
      .select('id, status, created_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, camera_model, appointment_date, demand_number')
      .eq('dealer_id', profile.dealer_id)
      .order('created_at', { ascending: false })

    const totalDemands = allDemands?.length || 0
    const pendingFinance = allDemands?.filter(d => d.status === 'pending_finance').length || 0
    const approved = allDemands?.filter(d => d.status === 'approved').length || 0
    const completed = allDemands?.filter(d => d.status === 'completed').length || 0
    const recentDemands = allDemands?.slice(0, 10) || []

    return (
      <div className="space-y-10">
        <WelcomeBanner
          title="Inventory Manager Dashboard"
          subtitle={dealer ? `Demands and customers for ${dealer.name} (${dealer.code})` : 'Dealer overview'}
          userName={(profile as { full_name?: string })?.full_name?.split(' ')[0]}
          timezone={imTimezoneName}
          userId={user.id}
        />

        <QuickActions
          actions={[
            { label: 'Demands', href: '/dashboard/admin/demands' },
            { label: 'Customers', href: '/dashboard/admin/customers' },
          ]}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Demands" value={totalDemands} subtitle="All time demands" icon={FileText} accentColor="blue" />
          <StatCard title="Pending Finance" value={pendingFinance} subtitle="Awaiting finance review" icon={Clock} accentColor="orange" />
          <StatCard title="Approved" value={approved} subtitle="Ready for installation" icon={AlertCircle} accentColor="white" />
          <StatCard title="Completed" value={completed} subtitle={totalDemands > 0 ? `${Math.round((completed / totalDemands) * 100)}% completion rate` : undefined} icon={CheckCircle} accentColor="green" />
        </div>

        <DataCard title="Recent Demands" action={{ label: 'View All', href: '/dashboard/admin/demands' }}>
          {recentDemands.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-zinc-500 dark:text-gray-400">No demands found for your dealer.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-gray-800/80">
              {recentDemands.map(demand => {
                const statusColors = {
                  pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                  approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                  completed: 'bg-green-900/50 text-green-300 border-green-800',
                  cancelled: 'bg-red-900/50 text-red-300 border-red-800'
                }
                return (
                  <li key={demand.id} className="px-6 py-4 hover:bg-white/[0.03] transition-colors">
                    <Link href={`/dashboard/admin/demands/${demand.id}`} className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            {demand.customer_firstname} {demand.customer_lastname}
                          </p>
                          {(demand as { demand_number?: number }).demand_number != null && (
                            <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                          )}
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-zinc-200/80 dark:bg-gray-900/50 text-zinc-600 dark:text-gray-300 border-zinc-200 dark:border-gray-800'}`}>
                            {demand.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-gray-400">
                          Camera: {demand.camera_model}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </DataCard>
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

    // Get all demands for this dealer (include invoice_total_amount for financial metrics)
    const { data: allDemands } = await supabase
      .from('demands')
      .select('id, status, created_at, completed_at, invoice_total_amount, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, camera_model, appointment_date')
      .eq('dealer_id', profile.dealer_id)
      .order('created_at', { ascending: false })

    // Financial metrics: Total Amount (all completed) and Monthly Amount
    const completedDemands = allDemands?.filter(d => d.status === 'completed') ?? []
    const totalAmount = completedDemands.reduce((sum, d) => sum + (d.invoice_total_amount ?? 0), 0)
    const params = await searchParams
    const monthParam = params.month
    const now = new Date()
    const selectedYear = monthParam ? parseInt(monthParam.slice(0, 4), 10) : now.getFullYear()
    const selectedMonth = monthParam ? parseInt(monthParam.slice(5, 7), 10) - 1 : now.getMonth()
    const monthStart = new Date(selectedYear, selectedMonth, 1)
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)
    const monthlyDemands = completedDemands.filter(d => {
      const completedAt = d.completed_at ? new Date(d.completed_at) : null
      return completedAt && completedAt >= monthStart && completedAt <= monthEnd
    })
    const monthlyAmount = monthlyDemands.reduce((sum, d) => sum + (d.invoice_total_amount ?? 0), 0)

    // Monthly demands for camera distribution (by created_at)
    const monthlyDemandsForCameras = (allDemands ?? []).filter(d => {
      const createdAt = d.created_at ? new Date(d.created_at) : null
      return createdAt && createdAt >= monthStart && createdAt <= monthEnd
    })
    const monthLabel = new Date(selectedYear, selectedMonth, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

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
      <div className="space-y-10">
        <WelcomeBanner
          title="General Manager Dashboard"
          subtitle={dealer ? `Overview for ${dealer.name} (${dealer.code})` : 'Dealer overview'}
          userName={(profile as { full_name?: string })?.full_name?.split(' ')[0]}
          timezone={gmTimezoneName}
          userId={user.id}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="Total Employees" value={totalEmployees} subtitle={`${salesCount} Sales, ${financeCount} Finance, ${specialistCount} Technical Support`} icon={Users} accentColor="white" />
          <StatCard title="Total Demands" value={totalDemands} subtitle="All time demands" icon={FileText} accentColor="blue" />
          <StatCard title="Today's Appointments" value={todayCount} subtitle="Scheduled for today" icon={Calendar} accentColor="orange" />
          <StatCard title="Completed" value={completed} subtitle={totalDemands > 0 ? `${Math.round((completed / totalDemands) * 100)}% completion rate` : undefined} icon={CheckCircle} accentColor="green" />
          <StatCard title="Total Amount" value={`$${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} subtitle="All completed invoices" icon={DollarSign} accentColor="white" />
          <div className="rounded-xl border border-zinc-200 dark:border-gray-800/80 bg-gradient-to-br from-white/[0.06] to-transparent p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-zinc-300 dark:border-gray-700/80">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-gray-400/90">Monthly Amount</p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-[#C27E00]">${monthlyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <div className="mt-1"><GMDashboardMonthSelector currentMonth={monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`} /></div>
          </div>
        </div>

        <CameraDistribution items={getCameraDistribution(monthlyDemandsForCameras)} monthLabel={monthLabel} />

        <div className="rounded-xl border border-zinc-200 dark:border-gray-800/80 bg-gradient-to-b from-white/[0.04] to-transparent overflow-hidden p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-5">Demand Status Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {todayCount > 0 && (
          <DataCard title="Today's Appointments" action={{ label: 'View All Demands', href: '/dashboard/admin/demands' }}>
              <ul className="divide-y divide-zinc-200 dark:divide-gray-800/80">
                {todayAppointments?.slice(0, 5).map(demand => (
                  <li key={demand.id} className="px-6 py-4 hover:bg-white/[0.03] transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            {demand.customer_firstname} {demand.customer_lastname}
                          </p>
                          {(demand as { demand_number?: number }).demand_number != null && (
                            <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-gray-400">
                          {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">
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
          </DataCard>
        )}

        <DataCard title="Recent Demands" action={{ label: 'View All', href: '/dashboard/admin/demands' }}>
            {recentDemands.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-zinc-500 dark:text-gray-400">No demands found for your dealer.</p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-gray-800/80">
                {recentDemands.map(demand => {
                  const statusColors = {
                    pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                    approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                    completed: 'bg-green-900/50 text-green-300 border-green-800',
                    cancelled: 'bg-red-900/50 text-red-300 border-red-800'
                  }
                  return (
                    <li key={demand.id} className="px-6 py-4 hover:bg-white/[0.03] transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold text-zinc-900 dark:text-white">
                              {demand.customer_firstname} {demand.customer_lastname}
                            </p>
                            {(demand as { demand_number?: number }).demand_number != null && (
                              <span className="text-xs font-medium text-zinc-500 dark:text-gray-500">#{(demand as { demand_number?: number }).demand_number}</span>
                            )}
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-zinc-200/80 dark:bg-gray-900/50 text-zinc-600 dark:text-gray-300 border-zinc-200 dark:border-gray-800'}`}>
                              {demand.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-500 dark:text-gray-400">
                            {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                          </p>
                          <p className="text-sm text-zinc-500 dark:text-gray-400">
                            Camera: {demand.camera_model}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">
                            Appointment: {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone(gmTimezoneName ?? null), 'PPP h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-zinc-500 dark:text-gray-500">
                            {formatInTimeZone(new Date(demand.created_at), getEffectiveTimezone(gmTimezoneName ?? null), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
        </DataCard>
      </div>
    )
  }

  // For other roles, show default dashboard
  return (
    <div className="space-y-10">
      <WelcomeBanner title="Dashboard" subtitle="Select an option from the sidebar to get started" timezone={SYSTEM_DEFAULT_TIMEZONE} userId={user.id} />
    </div>
  )
}

