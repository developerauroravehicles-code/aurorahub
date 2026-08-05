import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getDuplicateStockNumbers } from '@/lib/demand-stock'
import { DemandsList } from './demands-list'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'

export default async function DemandsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // Get dealer_id
  const { data: profile } = await supabase.from('profiles').select('dealer_id').eq('id', user.id).single()
  
  if (!profile) return <div>Profile error</div>

  // Get dealer info (timezone + warranty) for appointment display and print sheets
  let timezoneName: string | null = null
  let dealerName = 'Dealer'
  let dealerWarrantyYears: number | null = null
  if (profile.dealer_id) {
    const { data: dealer } = await supabase
      .from('dealers')
      .select('name, warranty_years, region_codes(timezone_id, timezones(name))')
      .eq('id', profile.dealer_id)
      .single()
    timezoneName = getTimezoneFromDealer(dealer as Parameters<typeof getTimezoneFromDealer>[0]) ?? null
    dealerName = dealer?.name ?? 'Dealer'
    dealerWarrantyYears = dealer?.warranty_years ?? null
  }

  // Fetch demands for this dealer
  const { data: demands } = await supabase
    .from('demands')
    .select('id, demand_number, status, created_at, customer_firstname, customer_lastname, customer_phone, customer_address, vin_last6, vehicle_year, vehicle_make, vehicle_model, stock_number, camera_model, appointment_date, comment')
    .eq('dealer_id', profile.dealer_id)
    .order('created_at', { ascending: false })

  const duplicateStockNumbers = Array.from(await getDuplicateStockNumbers())

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Demands</h1>
        <Link href="/dashboard/sales/demands/new" className="flex items-center bg-[#C27E00] text-white px-4 py-2 rounded-md hover:bg-[#a06900] transition-colors">
            <Plus className="w-4 h-4 mr-2" />
            New Demand
        </Link>
      </div>

      <DemandsList
        demands={demands || []}
        timezoneName={timezoneName}
        duplicateStockNumbers={duplicateStockNumbers}
        dealer={{ name: dealerName, warranty_years: dealerWarrantyYears }}
      />
    </div>
  )
}

