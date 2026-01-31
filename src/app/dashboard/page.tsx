import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'

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
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

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
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-gray-900/50 text-gray-300 border-gray-800'}`}>
                              {demand.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">
                            {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Appointment: {format(new Date(demand.appointment_date), 'PPP p')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {format(new Date(demand.created_at), 'MMM d, yyyy')}
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

  // If finance user, fetch their statistics
  if (profile.role === 'finance') {
    // Get all demands for statistics
    const { data: allDemands } = await supabase
      .from('demands')
      .select('*')
      .order('created_at', { ascending: false })

    // Get assigned demands for this finance user
    const { data: assignedDemands } = await supabase
      .from('demands')
      .select('*')
      .eq('assigned_finance_id', user.id)
      .order('created_at', { ascending: false })

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
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-gray-900/50 text-gray-300 border-gray-800'}`}>
                              {demand.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">
                            {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Appointment: {format(new Date(demand.appointment_date), 'PPP p')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {format(new Date(demand.created_at), 'MMM d, yyyy')}
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

