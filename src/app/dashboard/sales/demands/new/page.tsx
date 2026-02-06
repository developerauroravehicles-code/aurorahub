import { DemandForm } from './demand-form'
import { getCameraModels } from './get-cameras'
import { createClient } from '@/lib/supabase/server'

export default async function NewDemandPage() {
  const cameraModels = await getCameraModels()
  const supabase = await createClient()
  
  // Get current user's dealer information
  const { data: { user } } = await supabase.auth.getUser()
  let dealerName = ''
  let timezoneName: string | null = null
  
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('dealer_id')
      .eq('id', user.id)
      .single()
    
    if (profile?.dealer_id) {
      // Fetch dealer name and timezone
      const { data: dealer } = await supabase
        .from('dealers')
        .select('name, region_codes(timezone_id, timezones(name))')
        .eq('id', profile.dealer_id)
        .single()
      
      if (dealer) {
        dealerName = dealer.name
        if (dealer.region_codes && (dealer.region_codes as any).timezones) {
          timezoneName = (dealer.region_codes as any).timezones.name
        }
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-6">Create New Demand</h1>
      <DemandForm cameraModels={cameraModels} defaultAddress={dealerName} timezoneName={timezoneName} />
    </div>
  )
}

