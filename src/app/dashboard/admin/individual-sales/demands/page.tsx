import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { DemandsList } from '@/app/dashboard/admin/demands/demands-list'
import { DemandPrintHost } from '@/components/demand-print-host'
import { fetchBarcodeCodesByDemandIds } from '@/lib/inventory-barcodes/demand-barcode-search-index'
import { getDuplicateStockNumbers } from '@/lib/demand-stock'
import { isBarcodeModeEnabled } from '@/lib/inventory-barcodes'
import { getIndividualSalesDealerId } from '@/lib/individual-sales'
import { INDIVIDUAL_SALES_DEMANDS } from '@/lib/individual-sales'
import { ADMIN_DEMANDS_PAGE_SIZE, fetchAdminDemandsPage } from '@/lib/admin-demands-fetch'

export default async function IndividualSalesDemandsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') redirect('/dashboard')

  const params = await searchParams
  const hubDealerId = await getIndividualSalesDealerId(supabase)
  const pageNum = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const { data: demands, total: demandsTotal } = await fetchAdminDemandsPage(supabase, {
    dealerId: hubDealerId,
    status: params.status ?? null,
    q: params.q ?? null,
    page: pageNum,
    excludeIndividual: false,
    isIndividualOnly: true,
  })

  const dealers =
    hubDealerId != null
      ? (
          await supabase
            .from('dealers')
            .select('id, name, region_codes(timezone_id, timezones(name))')
            .eq('id', hubDealerId)
        ).data ?? []
      : []

  const { data: specialists } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'specialist')
    .order('full_name')

  const duplicateStockNumbers = Array.from(await getDuplicateStockNumbers(hubDealerId))
  const barcodeModeEnabled = await isBarcodeModeEnabled(supabase)
  const demandIds = (demands ?? []).map((d) => d.id as string).filter(Boolean)
  const barcodeCodesByDemandId =
    demandIds.length > 0
      ? await fetchBarcodeCodesByDemandIds(createAdminClient(), demandIds)
      : {}

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Appointments</h2>
        <Link
          href={`${INDIVIDUAL_SALES_DEMANDS}/new`}
          className="inline-flex items-center gap-2 rounded-md bg-[#C27E00] px-3 py-2 text-sm font-semibold text-white hover:bg-[#a06900]"
        >
          <Plus className="h-4 w-4" />
          New appointment
        </Link>
      </div>

      {!hubDealerId ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Run migration <code className="text-xs">20261119180000_individual_sales.sql</code> to enable creation.
        </p>
      ) : null}

      <DemandPrintHost>
        <DemandsList
          demands={(demands ?? []) as unknown as Parameters<typeof DemandsList>[0]['demands']}
          dealers={dealers}
          specialists={specialists ?? []}
          selectedDealerId={hubDealerId ?? 'all'}
          canCreateExternal={false}
          hideDealerFilter
          duplicateStockNumbers={duplicateStockNumbers}
          barcodeModeEnabled={barcodeModeEnabled}
          barcodeCodesByDemandId={barcodeCodesByDemandId}
          listBasePath={INDIVIDUAL_SALES_DEMANDS}
          demandDetailReturn={INDIVIDUAL_SALES_DEMANDS}
          filtersStorageKey="aurora_individual_sales_demands_filters_v1"
          serverTotalCount={demandsTotal}
          serverPage={pageNum}
          serverPageSize={ADMIN_DEMANDS_PAGE_SIZE}
          serverSearchQuery={params.q ?? ''}
        />
      </DemandPrintHost>
    </div>
  )
}