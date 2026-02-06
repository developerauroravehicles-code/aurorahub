import { createClient } from '@/lib/supabase/server'
import { SystemManagementTabs } from '../system-management-tabs'
import { RegionManagementContent } from './region-management-content'
import { createRegionCode, updateRegionCode, deleteRegionCode } from './actions'

export const dynamic = 'force-dynamic'

export default async function RegionManagementPage() {
  const supabase = await createClient()
  
  // Fetch region codes with timezone
  const { data: regionCodes } = await supabase
    .from('region_codes')
    .select('id, code, name, description, timezone_id, timezones(id, name, display_name, utc_offset), created_at, updated_at')
    .order('code')

  // Fetch all timezones for selection
  const { data: timezones } = await supabase
    .from('timezones')
    .select('id, name, display_name, utc_offset')
    .order('display_name')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6 text-white">System Management</h1>
        
        <SystemManagementTabs activeTab="region" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <RegionManagementContent 
            regionCodes={regionCodes || []}
            timezones={timezones || []}
            createRegionCode={createRegionCode}
            updateRegionCode={updateRegionCode}
            deleteRegionCode={deleteRegionCode}
          />
        </div>
      </div>
    </div>
  )
}

