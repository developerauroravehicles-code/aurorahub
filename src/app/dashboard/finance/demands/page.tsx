import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { FinanceDemandsList } from './finance-demands-list'

export default async function FinanceDemandsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('dealer_id').eq('id', user.id).single()
  const dealerId = profile?.dealer_id

  const demandSelect = '*, dealers(name, region_codes(timezone_id, timezones(name))), profiles!demands_assigned_finance_id_fkey(full_name)'
  const demandSelectShort = 'id, demand_number, status, created_at, dealer_id, customer_firstname, customer_lastname, customer_phone, customer_address, vehicle_make, vehicle_model, vehicle_year, stock_number, camera_model, appointment_date, assigned_specialist_id, comment, dealers(name, region_codes(timezone_id, timezones(name))), profiles!demands_assigned_finance_id_fkey(full_name)'

  // Finance sees all demands from their dealer (bayi). If no dealer_id, show empty.

  // Get unassigned demands from this dealer
  const unassignedQuery = supabase
    .from('demands')
    .select(demandSelect)
    .eq('status', 'pending_finance')
    .is('assigned_finance_id', null)
    .order('created_at', { ascending: true })
  const { data: unassignedDemandsRaw } = dealerId
    ? await unassignedQuery.eq('dealer_id', dealerId)
    : await unassignedQuery.eq('dealer_id', '00000000-0000-0000-0000-000000000000') // no dealer = empty

  // Get assigned demands for current user (from this dealer)
  const myAssignedQuery = supabase
    .from('demands')
    .select(demandSelectShort)
    .eq('assigned_finance_id', user.id)
    .in('status', ['pending_finance', 'approved'])
    .order('created_at', { ascending: true })
  const { data: myAssignedDemandsRaw } = dealerId
    ? await myAssignedQuery.eq('dealer_id', dealerId)
    : await myAssignedQuery.eq('dealer_id', '00000000-0000-0000-0000-000000000000')

  // Get all other assigned demands (assigned to other finance, from this dealer) - pending_finance and approved
  const allAssignedQuery = supabase
    .from('demands')
    .select(demandSelect)
    .in('status', ['pending_finance', 'approved'])
    .not('assigned_finance_id', 'is', null)
    .neq('assigned_finance_id', user.id) // exclude my own (they're in myAssigned)
    .order('created_at', { ascending: true })
  const { data: allAssignedDemandsRaw } = dealerId
    ? await allAssignedQuery.eq('dealer_id', dealerId)
    : await allAssignedQuery.eq('dealer_id', '00000000-0000-0000-0000-000000000000')

  // Get completed demands from this dealer (for visibility)
  const completedQuery = supabase
    .from('demands')
    .select(demandSelect)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
  const { data: completedDemandsRaw } = dealerId
    ? await completedQuery.eq('dealer_id', dealerId)
    : await completedQuery.eq('dealer_id', '00000000-0000-0000-0000-000000000000')

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
  const completedDemands = completedDemandsRaw?.map(transformDemand) || []

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
        completedDemands={completedDemands || []}
      />
    </div>
  )
}

