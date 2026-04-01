'use client'

import { RegionCodeManagement } from './region-code-management'
import { TimezoneManagement } from './timezone-management'

interface RegionCode {
  id: string
  code: string
  name: string
  description: string | null
  timezone_id: string | null
  timezones?: {
    id: string
    name: string
    display_name: string
    utc_offset: string
  } | null
}

interface Timezone {
  id: string
  name: string
  display_name: string
  utc_offset: string
}

export function RegionManagementContent({
  regionCodes,
  timezones,
  createRegionCode,
  updateRegionCode,
  deleteRegionCode
}: {
  regionCodes: RegionCode[]
  timezones: Timezone[]
  createRegionCode: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  updateRegionCode: (regionCodeId: string, code: string, name: string, description: string | null, timezoneId: string | null) => Promise<{ success: boolean; error?: string }>
  deleteRegionCode: (regionCodeId: string) => Promise<{ success: boolean; error?: string }>
}) {
  return (
    <div className="space-y-8">
      {/* Timezone Management */}
      <div>
        <h2 className="text-lg font-medium mb-4 text-zinc-900 dark:text-white">Timezone Management</h2>
        <TimezoneManagement timezones={timezones} />
      </div>

      {/* Region Codes Management */}
      <div>
        <h2 className="text-lg font-medium mb-4 text-zinc-900 dark:text-white">Region Codes Management</h2>
        <RegionCodeManagement 
          regionCodes={regionCodes}
          timezones={timezones}
          createRegionCode={createRegionCode}
          updateRegionCode={updateRegionCode}
          deleteRegionCode={deleteRegionCode}
        />
      </div>
    </div>
  )
}
