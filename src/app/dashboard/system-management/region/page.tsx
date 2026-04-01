import { createClient } from '@/lib/supabase/server'
import { SystemManagementTabs } from '../system-management-tabs'
import { SystemManagementTitle } from '../system-management-title'
import { RegionManagementContent } from './region-management-content'
import { createRegionCode, updateRegionCode, deleteRegionCode } from './actions'

export const dynamic = 'force-dynamic'

export default async function RegionManagementPage() {
  const supabase = await createClient()
  
  // Fetch region codes with timezone
  const { data: regionCodesRaw } = await supabase
    .from('region_codes')
    .select('id, code, name, description, timezone_id, timezones(id, name, display_name, utc_offset), created_at, updated_at')
    .order('code')
  
  // Transform data to match component's expected type
  const regionCodes = regionCodesRaw?.map((rc: any) => ({
    ...rc,
    timezones: rc.timezones && Array.isArray(rc.timezones) && rc.timezones.length > 0
      ? rc.timezones[0]
      : rc.timezones && !Array.isArray(rc.timezones)
      ? rc.timezones
      : null
  })) || []

  // Fetch all timezones for selection
  const { data: timezones } = await supabase
    .from('timezones')
    .select('id, name, display_name, utc_offset')
    .order('display_name')

  return (
    <div className="space-y-8">
      <div>
        <SystemManagementTitle />
        
        <SystemManagementTabs activeTab="region" />

        {/* Tab Content */}
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
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

