'use client'

import { RegionCodeManagement } from './region-code-management'

interface RegionCode {
  id: string
  code: string
  name: string
  description: string | null
}

export function RegionManagementContent({
  regionCodes,
  createRegionCode,
  updateRegionCode,
  deleteRegionCode
}: {
  regionCodes: RegionCode[]
  createRegionCode: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  updateRegionCode: (regionCodeId: string, code: string, name: string, description: string | null) => Promise<{ success: boolean; error?: string }>
  deleteRegionCode: (regionCodeId: string) => Promise<{ success: boolean; error?: string }>
}) {
  return (
    <div className="space-y-8">
      {/* Region Codes Management */}
      <div>
        <h2 className="text-lg font-medium mb-4 text-white">Region Codes Management</h2>
        <RegionCodeManagement 
          regionCodes={regionCodes} 
          createRegionCode={createRegionCode}
          updateRegionCode={updateRegionCode}
          deleteRegionCode={deleteRegionCode}
        />
      </div>
    </div>
  )
}
