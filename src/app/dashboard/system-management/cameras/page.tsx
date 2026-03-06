import { getSystemData } from '../actions'
import { SystemManagementTabs } from '../system-management-tabs'
import { SystemManagementTitle } from '../system-management-title'
import { CameraManagementContent } from './camera-management-content-new'

export const dynamic = 'force-dynamic'

export default async function CameraManagementPage() {
  const { cameras, dealers, errors } = await getSystemData()

  return (
    <div className="space-y-8">
      <div>
        <SystemManagementTitle />
        
        <SystemManagementTabs activeTab="cameras" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <CameraManagementContent cameras={cameras} dealers={dealers} errors={errors} />
        </div>
      </div>
    </div>
  )
}

