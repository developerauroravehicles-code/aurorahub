import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDuplicateStockNumbers } from '@/lib/demand-stock'
import { getInventoryManagerDealerId, isInventoryManager } from '@/lib/inventory-manager-access'
import { DemandsList } from './demands-list'

const ADMIN_DEMANDS_SELECT =
  '*, dealers(name, region_codes(timezone_id, timezones(name))), profiles!demands_created_by_fkey(full_name), assigned_specialist:profiles!demands_assigned_specialist_id_fkey(full_name), assigned_finance:profiles!demands_assigned_finance_id_fkey(full_name)'

const DEMANDS_PAGE_SIZE = 1000

async function fetchAllAdminDemands(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealerId: string | null
) {
  const rows = []
  let from = 0

  while (true) {
    let query = supabase
      .from('demands')
      .select(ADMIN_DEMANDS_SELECT)
      .order('created_at', { ascending: false })
      .range(from, from + DEMANDS_PAGE_SIZE - 1)

    if (dealerId) {
      query = query.eq('dealer_id', dealerId)
    }

    const { data, error } = await query
    if (error) throw error
    if (!data?.length) break

    rows.push(...data)
    if (data.length < DEMANDS_PAGE_SIZE) break
    from += DEMANDS_PAGE_SIZE
  }

  return rows
}

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
  const imDealerId = getInventoryManagerDealerId(profile)

  if (isInventoryManager(profile?.role) && !imDealerId) {
    redirect('/dashboard')
  }

  const isDealerScopedAdmin = (isGM && profile?.dealer_id) || !!imDealerId

  const params = await searchParams
  const dealerId = imDealerId
    ?? (isGM && profile?.dealer_id ? profile.dealer_id : null)
    ?? (params.dealer && params.dealer !== 'all' ? params.dealer : null)

  let dealersQuery = supabase.from('dealers').select('id, name, region_codes(timezone_id, timezones(name))').order('name')
  if (imDealerId) {
    dealersQuery = supabase.from('dealers').select('id, name, region_codes(timezone_id, timezones(name))').eq('id', imDealerId)
  }

  const { data: dealers } = await dealersQuery

  const demands = await fetchAllAdminDemands(supabase, dealerId)

  const { data: specialists } = canCreateExternal
    ? await supabase.from('profiles').select('id, full_name').eq('role', 'specialist').order('full_name')
    : { data: [] }

  const duplicateStockNumbersSet = await getDuplicateStockNumbers(imDealerId)
  const duplicateStockNumbers = Array.from(duplicateStockNumbersSet)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-4 text-zinc-900 dark:text-white">
          {imDealerId ? 'Dealer Demands' : 'All Demands'}
        </h1>
        <DemandsList
          demands={demands || []}
          dealers={dealers || []}
          specialists={specialists || []}
          selectedDealerId={isDealerScopedAdmin ? (imDealerId ?? profile!.dealer_id!) : (params.dealer ?? 'all')}
          canCreateExternal={canCreateExternal}
          hideDealerFilter={!!isDealerScopedAdmin}
          duplicateStockNumbers={duplicateStockNumbers}
        />
      </div>
    </div>
  )
}
