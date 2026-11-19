import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchBarcodeCodesByDemandIds } from '@/lib/inventory-barcodes/demand-barcode-search-index'
import { redirect } from 'next/navigation'
import { getDuplicateStockNumbers } from '@/lib/demand-stock'
import { getInventoryManagerDealerId, isInventoryManager } from '@/lib/inventory-manager-access'
import { isBarcodeModeEnabled } from '@/lib/inventory-barcodes'
import { DemandsList } from './demands-list'
import { DemandPrintHost } from '@/components/demand-print-host'
import { ADMIN_DEMANDS_PAGE_SIZE, fetchAdminDemandsPage } from '@/lib/admin-demands-fetch'

export default async function AdminDemandsPage({
  searchParams,
}: {
  searchParams: Promise<{ dealer?: string; status?: string; q?: string; page?: string }>
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

  const pageNum = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const { data: demands, total: demandsTotal } = await fetchAdminDemandsPage(supabase, {
    dealerId,
    status: params.status ?? null,
    q: params.q ?? null,
    page: pageNum,
  })

  const { data: specialists } = canCreateExternal
    ? await supabase.from('profiles').select('id, full_name').eq('role', 'specialist').order('full_name')
    : { data: [] }

  const duplicateStockNumbersSet = await getDuplicateStockNumbers(imDealerId)
  const duplicateStockNumbers = Array.from(duplicateStockNumbersSet)
  const barcodeModeEnabled = await isBarcodeModeEnabled(supabase)

  const demandIds = (demands ?? []).map((d) => d.id as string).filter(Boolean)
  const barcodeCodesByDemandId =
    demandIds.length > 0
      ? await fetchBarcodeCodesByDemandIds(createAdminClient(), demandIds)
      : {}

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-4 text-zinc-900 dark:text-white">
          {imDealerId ? 'Dealer Demands' : 'All Demands'}
        </h1>
        <DemandPrintHost>
          <DemandsList
            demands={(demands || []) as unknown as Parameters<typeof DemandsList>[0]['demands']}
            dealers={dealers || []}
            specialists={specialists || []}
            selectedDealerId={isDealerScopedAdmin ? (imDealerId ?? profile!.dealer_id!) : (params.dealer ?? 'all')}
            canCreateExternal={canCreateExternal}
            hideDealerFilter={!!isDealerScopedAdmin}
            duplicateStockNumbers={duplicateStockNumbers}
            barcodeModeEnabled={barcodeModeEnabled}
            barcodeCodesByDemandId={barcodeCodesByDemandId}
            serverTotalCount={demandsTotal}
            serverPage={pageNum}
            serverPageSize={ADMIN_DEMANDS_PAGE_SIZE}
            serverSearchQuery={params.q ?? ''}
          />
        </DemandPrintHost>
      </div>
    </div>
  )
}
