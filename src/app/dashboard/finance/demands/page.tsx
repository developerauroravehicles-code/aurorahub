import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getDuplicateStockNumbers } from '@/lib/demand-stock'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { FinanceDemandsList } from './finance-demands-list'

const EMPTY_DEALER = '00000000-0000-0000-0000-000000000000'

const demandSelect =
  '*, dealers(name, region_codes(timezone_id, timezones(name))), profiles!demands_assigned_finance_id_fkey(full_name)'

export default async function FinanceDemandsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('dealer_id')
    .eq('id', user.id)
    .single()
  const dealerId = profile?.dealer_id
  const dealerFilter = dealerId ?? EMPTY_DEALER

  const { data: activeDemandsRaw } = await supabase
    .from('demands')
    .select(demandSelect)
    .eq('dealer_id', dealerFilter)
    .in('status', ['pending_finance', 'approved'])
    .order('created_at', { ascending: false })

  const { data: completedDemandsRaw } = await supabase
    .from('demands')
    .select(demandSelect)
    .eq('dealer_id', dealerFilter)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const transformDemand = (demand: any) => {
    const dealersRaw = demand.dealers
    const dealers = dealersRaw
      ? {
          name: dealersRaw.name,
          region_codes: dealersRaw.region_codes ?? undefined,
        }
      : null
    const profilesRaw = demand.profiles
    const profiles = profilesRaw
      ? Array.isArray(profilesRaw)
        ? profilesRaw[0]
        : profilesRaw
      : null
    return { ...demand, dealers, profiles }
  }

  const activeDemands = activeDemandsRaw?.map(transformDemand) || []
  const completedDemands = completedDemandsRaw?.map(transformDemand) || []
  const duplicateStockNumbers = Array.from(await getDuplicateStockNumbers())

  let dealerName = 'Dealer'
  let dealerWarrantyYears: number | null = null
  let timezoneName: string | null = null
  if (dealerId) {
    const { data: dealerRow } = await supabase
      .from('dealers')
      .select('name, warranty_years, region_codes(timezone_id, timezones(name))')
      .eq('id', dealerId)
      .single()
    dealerName = dealerRow?.name ?? 'Dealer'
    dealerWarrantyYears = dealerRow?.warranty_years ?? null
    timezoneName = getTimezoneFromDealer(dealerRow as Parameters<typeof getTimezoneFromDealer>[0]) ?? null
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">
            Demand Management
          </h1>
          <p className="text-zinc-500 dark:text-gray-400">
            View all dealer demands (newest first). Assign from the pool or manage demands assigned
            to you.
          </p>
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
        activeDemands={activeDemands}
        completedDemands={completedDemands}
        currentUserId={user.id}
        duplicateStockNumbers={duplicateStockNumbers}
        dealer={{ name: dealerName, warranty_years: dealerWarrantyYears }}
        timezoneName={timezoneName}
      />
    </div>
  )
}
