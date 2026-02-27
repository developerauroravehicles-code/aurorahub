import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DemandsList } from './demands-list'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'

export default async function DemandsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // Get dealer_id
  const { data: profile } = await supabase.from('profiles').select('dealer_id').eq('id', user.id).single()
  
  if (!profile) return <div>Profile error</div>

  // Get dealer timezone for appointment display
  let timezoneName: string | null = null
  if (profile.dealer_id) {
    const { data: dealer } = await supabase
      .from('dealers')
      .select('region_codes(timezone_id, timezones(name))')
      .eq('id', profile.dealer_id)
      .single()
    timezoneName = getTimezoneFromDealer(dealer as Parameters<typeof getTimezoneFromDealer>[0]) ?? null
  }

  // Fetch demands for this dealer
  const { data: demands } = await supabase
    .from('demands')
    .select('id, demand_number, status, created_at, customer_firstname, customer_lastname, vehicle_year, vehicle_make, vehicle_model, appointment_date, comment')
    .eq('dealer_id', profile.dealer_id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-white">Demands</h1>
        <Link href="/dashboard/sales/demands/new" className="flex items-center bg-[#C27E00] text-white px-4 py-2 rounded-md hover:bg-[#a06900] transition-colors">
            <Plus className="w-4 h-4 mr-2" />
            New Demand
        </Link>
      </div>

      <DemandsList demands={demands || []} timezoneName={timezoneName} />
    </div>
  )
}

