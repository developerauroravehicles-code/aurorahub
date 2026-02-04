import { createClient } from '@/lib/supabase/server'
import { SystemManagementTabs } from '../system-management-tabs'
import { DealerManagementContent } from './dealer-management-content-new'
import { updateDealerRegionCode, addCameraToDealer, removeCameraFromDealer } from '../region/actions'

export const dynamic = 'force-dynamic'

export default async function DealerManagementPage() {
  const supabase = await createClient()
  
  // Fetch region codes first (needed for merging)
  const { data: regionCodes } = await supabase
    .from('region_codes')
    .select('*')
    .order('code')
  
  // Fetch dealers with region codes join
  const { data: dealers } = await supabase
    .from('dealers')
    .select(`
      *,
      region_codes(id, code, name, description),
      dealer_cameras(
        camera_model_id,
        camera_models(id, name, is_active)
      )
    `)
    .order('created_at')
  
  const { data: cameraModels } = await supabase
    .from('camera_models')
    .select('*')
    .eq('is_active', true)
    .order('name')

  // Merge region codes with dealers manually (in case join doesn't work)
  const dealersWithRegionCodes = dealers?.map(dealer => {
    // First try to use the joined region_codes
    if (dealer.region_codes && Array.isArray(dealer.region_codes) && dealer.region_codes.length > 0) {
      return { ...dealer, region_codes: dealer.region_codes[0] }
    }
    // If join didn't work, manually find it
    if (dealer.region_code_id) {
      const regionCode = regionCodes?.find(rc => rc.id === dealer.region_code_id)
      return { ...dealer, region_codes: regionCode || null }
    }
    return { ...dealer, region_codes: null }
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6 text-white">System Management</h1>
        
        <SystemManagementTabs activeTab="dealer" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <DealerManagementContent 
            dealers={dealersWithRegionCodes || dealers || []}
            regionCodes={regionCodes || []}
            cameraModels={cameraModels || []}
            updateDealerRegionCode={updateDealerRegionCode}
            addCameraToDealer={addCameraToDealer}
            removeCameraFromDealer={removeCameraFromDealer}
          />
        </div>
      </div>
    </div>
  )
}

