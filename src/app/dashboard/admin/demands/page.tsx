import { createClient } from '@/lib/supabase/server'
import { getDuplicateStockNumbers } from '@/lib/demand-stock'
import { DemandsList } from './demands-list'

export default async function AdminDemandsPage({
  searchParams,
}: {
  searchParams: Promise<{ dealer?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role, dealer_id').eq('id', user.id).single()
    : { data: null }
  const canCreateExternal = profile?.role === 'aurora_manager'
  const isGM = profile?.role === 'general_manager'
  const isInventoryManager = profile?.role === 'inventory_manager'
  const isDealerScopedAdmin = (isGM || isInventoryManager) && profile?.dealer_id

  const params = await searchParams
  const dealerId = isDealerScopedAdmin
    ? profile.dealer_id
    : params.dealer && params.dealer !== 'all'
      ? params.dealer
      : null

  const { data: dealers } = await supabase
    .from('dealers')
    .select('id, name')
    .order('name')

  let demandsQuery = supabase
    .from('demands')
    .select('*, dealers(name, region_codes(timezone_id, timezones(name))), profiles!demands_created_by_fkey(full_name), assigned_specialist:profiles!demands_assigned_specialist_id_fkey(full_name), assigned_finance:profiles!demands_assigned_finance_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (dealerId) {
    demandsQuery = demandsQuery.eq('dealer_id', dealerId)
  }

  const { data: demands } = await demandsQuery

  const { data: specialists } = canCreateExternal
    ? await supabase.from('profiles').select('id, full_name').eq('role', 'specialist').order('full_name')
    : { data: [] }

  const duplicateStockNumbersSet = await getDuplicateStockNumbers()
  const duplicateStockNumbers = Array.from(duplicateStockNumbersSet)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-4 text-zinc-900 dark:text-white">All Demands</h1>
        <DemandsList
          demands={demands || []}
          dealers={dealers || []}
          specialists={specialists || []}
          selectedDealerId={isDealerScopedAdmin ? profile.dealer_id : (params.dealer ?? 'all')}
          canCreateExternal={canCreateExternal}
          hideDealerFilter={!!isDealerScopedAdmin}
          duplicateStockNumbers={duplicateStockNumbers}
        />
      </div>
    </div>
  )
}
