import { createClient } from '@/lib/supabase/server'
import { SystemManagementTabs } from '../system-management-tabs'
import { SystemManagementTitle } from '../system-management-title'
import { DealerManagementContent } from './dealer-management-content-new'
import { updateDealerRegionCode, addCameraToDealer, removeCameraFromDealer } from '../region/actions'
import type { Dealer } from '@/types/system-management'

export const dynamic = 'force-dynamic'

export default async function DealerManagementPage() {
  const supabase = await createClient()
  
  // Fetch region codes first (needed for merging)
  const { data: regionCodes } = await supabase
    .from('region_codes')
    .select('id, code, name, description, created_at, updated_at')
    .order('code')
  
  // Fetch dealers with region codes join
  const { data: dealers } = await supabase
    .from('dealers')
    .select(`
      id, name, code, address, phone, region_code_id, created_at,
      region_codes(id, code, name, description),
      dealer_cameras(
        camera_model_id,
        camera_models(id, name, is_active)
      )
    `)
    .order('created_at')
  
  const { data: cameraModels } = await supabase
    .from('camera_models')
    .select('id, name, is_active, stock_quantity, description')
    .eq('is_active', true)
    .order('name')

  // Merge region codes with dealers manually (in case join doesn't work)
  const dealersWithRegionCodes: Dealer[] = dealers?.map(dealer => {
    // Transform dealer_cameras to match DealerCamera type
    const transformedDealerCameras = (dealer.dealer_cameras || []).map((dc: any) => ({
      dealer_id: dealer.id,
      camera_model_id: dc.camera_model_id,
      camera_models: Array.isArray(dc.camera_models) ? dc.camera_models[0] : dc.camera_models,
      dealers: undefined
    }))
    
    // First try to use the joined region_codes
    if (dealer.region_codes && Array.isArray(dealer.region_codes) && dealer.region_codes.length > 0) {
      return { ...dealer, region_codes: dealer.region_codes[0], dealer_cameras: transformedDealerCameras } as Dealer
    }
    // If join didn't work, manually find it
    if (dealer.region_code_id) {
      const regionCode = regionCodes?.find(rc => rc.id === dealer.region_code_id)
      return { ...dealer, region_codes: regionCode || null, dealer_cameras: transformedDealerCameras } as Dealer
    }
    return { ...dealer, region_codes: null, dealer_cameras: transformedDealerCameras } as Dealer
  }) || []

  return (
    <div className="space-y-8">
      <div>
        <SystemManagementTitle />
        
        <SystemManagementTabs activeTab="dealer" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <DealerManagementContent 
            dealers={dealersWithRegionCodes}
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

