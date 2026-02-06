import { DemandForm } from './demand-form'
import { getCameraModels } from './get-cameras'
import { createClient } from '@/lib/supabase/server'

export default async function NewDemandPage() {
  const cameraModels = await getCameraModels()
  const supabase = await createClient()
  
  // Get current user's dealer information
  const { data: { user } } = await supabase.auth.getUser()
  let dealerName = ''
  
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('dealer_id')
      .eq('id', user.id)
      .single()
    
    if (profile?.dealer_id) {
      // Fetch dealer name directly
      const { data: dealer } = await supabase
        .from('dealers')
        .select('name')
        .eq('id', profile.dealer_id)
        .single()
      
      if (dealer) {
        dealerName = dealer.name
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-6">Create New Demand</h1>
      <DemandForm cameraModels={cameraModels} defaultAddress={dealerName} />
    </div>
  )
}

