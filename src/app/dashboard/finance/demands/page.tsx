import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { FinanceDemandsList } from './finance-demands-list'

export default async function FinanceDemandsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // Get unassigned demands (demand pool) — dealer timezone for correct appointment display
  const { data: unassignedDemandsRaw } = await supabase
    .from('demands')
    .select('*, dealers(name, region_codes(timezone_id, timezones(name))), profiles!demands_assigned_finance_id_fkey(full_name)')
    .eq('status', 'pending_finance')
    .is('assigned_finance_id', null)
    .order('created_at', { ascending: true })

  // Get assigned demands for current user (with dealer timezone for correct appointment display)
  const { data: myAssignedDemandsRaw } = await supabase
    .from('demands')
    .select('id, demand_number, status, created_at, dealer_id, customer_firstname, customer_lastname, customer_phone, customer_address, vehicle_make, vehicle_model, vehicle_year, stock_number, camera_model, appointment_date, assigned_specialist_id, dealers(name, region_codes(timezone_id, timezones(name))), profiles!demands_assigned_finance_id_fkey(full_name)')
    .eq('assigned_finance_id', user.id)
    .in('status', ['pending_finance', 'approved'])
    .order('created_at', { ascending: true })

  // Get all assigned demands (for reference) — dealer timezone for correct appointment display
  const { data: allAssignedDemandsRaw } = await supabase
    .from('demands')
    .select('*, dealers(name, region_codes(timezone_id, timezones(name))), profiles!demands_assigned_finance_id_fkey(full_name)')
    .eq('status', 'pending_finance')
    .not('assigned_finance_id', 'is', null)
    .order('created_at', { ascending: true })

  // Transform data — keep dealers with region_codes/timezone for correct appointment display
  const transformDemand = (demand: any) => {
    const dealersRaw = demand.dealers
    const dealers = dealersRaw
      ? {
          name: (dealersRaw as any).name,
          region_codes: (dealersRaw as any).region_codes ?? undefined
        }
      : null
    return {
      ...demand,
      dealers,
      profiles: demand.profiles ? (Array.isArray(demand.profiles) ? demand.profiles[0] : demand.profiles) : null
    }
  }

  const unassignedDemands = unassignedDemandsRaw?.map(transformDemand) || []
  const myAssignedDemands = myAssignedDemandsRaw?.map(transformDemand) || []
  const allAssignedDemands = allAssignedDemandsRaw?.map(transformDemand) || []

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Demand Management</h1>
          <p className="text-gray-400">Create new demands, assign demands from the pool, or manage your assigned demands.</p>
        </div>
        <Link
          href="/dashboard/finance/demands/new"
          className="inline-flex items-center gap-2 bg-[#C27E00] text-white px-4 py-2 rounded-md hover:bg-[#a06900] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Demand
        </Link>
      </div>

      <FinanceDemandsList 
        myAssignedDemands={myAssignedDemands || []}
        unassignedDemands={unassignedDemands || []}
        allAssignedDemands={allAssignedDemands || []}
      />
    </div>
  )
}

