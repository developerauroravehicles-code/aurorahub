import { createClient } from '@/lib/supabase/server'
import { FinanceDemandsList } from './finance-demands-list'

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

  // Get assigned demands for current user (with all fields for editing)
  const { data: myAssignedDemands } = await supabase
    .from('demands')
    .select('id, status, created_at, customer_firstname, customer_lastname, customer_phone, customer_address, vehicle_make, vehicle_model, vehicle_year, stock_number, camera_model, appointment_date, dealers(name), profiles!demands_assigned_finance_id_fkey(full_name)')
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

      <FinanceDemandsList 
        myAssignedDemands={myAssignedDemands || []}
        unassignedDemands={unassignedDemands || []}
        allAssignedDemands={allAssignedDemands || []}
      />
    </div>
  )
}

