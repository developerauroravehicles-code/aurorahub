import { createClient } from '@/lib/supabase/server'
import { DemandActions } from './demand-actions'
import { format } from 'date-fns'

export default async function FinanceDemandsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // Get unassigned demands (demand pool)
  const { data: unassignedDemands } = await supabase
    .from('demands')
    .select('*, dealers(name), profiles!demands_assigned_finance_id_fkey(full_name)')
    .eq('status', 'pending_finance')
    .is('assigned_finance_id', null)
    .order('created_at', { ascending: true })

  // Get assigned demands for current user
  const { data: myAssignedDemands } = await supabase
    .from('demands')
    .select('*, dealers(name), profiles!demands_assigned_finance_id_fkey(full_name)')
    .eq('assigned_finance_id', user.id)
    .in('status', ['pending_finance', 'approved'])
    .order('created_at', { ascending: true })

  // Get all assigned demands (for reference)
  const { data: allAssignedDemands } = await supabase
    .from('demands')
    .select('*, dealers(name), profiles!demands_assigned_finance_id_fkey(full_name)')
    .eq('status', 'pending_finance')
    .not('assigned_finance_id', 'is', null)
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Demand Management</h1>
        <p className="text-gray-400">Assign demands to yourself from the pool or manage your assigned demands.</p>
      </div>

      {/* My Assigned Demands */}
      {myAssignedDemands && myAssignedDemands.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">My Assigned Demands ({myAssignedDemands.length})</h2>
          <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
            <ul className="divide-y divide-gray-800">
              {myAssignedDemands.map(demand => (
                <li key={demand.id} className="p-4 sm:px-6 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-lg font-medium text-[#C27E00]">
                          {demand.customer_firstname} {demand.customer_lastname}
                        </p>
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
                      <p className="text-sm text-gray-400">
                        {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                      </p>
                      <p className="text-sm text-gray-400">
                        Appointment: <span className="font-semibold text-white">{format(new Date(demand.appointment_date), 'PPP p')}</span>
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Dealer: {(demand.dealers as any)?.name}
                      </p>
                    </div>
                    <DemandActions demandId={demand.id} isAssigned={true} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Demand Pool - Unassigned Demands */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">
          Demand Pool - Unassigned ({unassignedDemands?.length || 0})
        </h2>
        <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
          {(!unassignedDemands || unassignedDemands.length === 0) ? (
            <p className="p-4 text-gray-400 text-center">No unassigned demands in the pool.</p>
          ) : (
            <ul className="divide-y divide-gray-800">
              {unassignedDemands.map(demand => (
                <li key={demand.id} className="p-4 sm:px-6 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-lg font-medium text-white">
                          {demand.customer_firstname} {demand.customer_lastname}
                        </p>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-900/50 text-gray-300 border border-gray-800">
                          UNASSIGNED
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                      </p>
                      <p className="text-sm text-gray-400">
                        Appointment: <span className="font-semibold text-white">{format(new Date(demand.appointment_date), 'PPP p')}</span>
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Dealer: {(demand.dealers as any)?.name}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Created: {format(new Date(demand.created_at), 'PPP p')}
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

      {/* Other Assigned Demands (for reference) */}
      {allAssignedDemands && allAssignedDemands.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">
            Assigned to Others ({allAssignedDemands.length})
          </h2>
          <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
            <ul className="divide-y divide-gray-800">
              {allAssignedDemands.map(demand => (
                <li key={demand.id} className="p-4 sm:px-6 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-lg font-medium text-gray-500">
                          {demand.customer_firstname} {demand.customer_lastname}
                        </p>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-800">
                          ASSIGNED TO: {(demand.profiles as any)?.full_name || 'Unknown'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                      </p>
                      <p className="text-sm text-gray-500">
                        Appointment: {format(new Date(demand.appointment_date), 'PPP p')}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Dealer: {(demand.dealers as any)?.name}
                      </p>
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

