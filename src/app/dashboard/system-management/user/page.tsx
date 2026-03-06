import { getSystemData } from '../actions'
import { SystemManagementTabs } from '../system-management-tabs'
import { SystemManagementTitle } from '../system-management-title'
import { UserManagementContent } from './user-management-content'

export const dynamic = 'force-dynamic'

export default async function UserManagementPage() {
  const { profiles, errors, dealers } = await getSystemData()

  return (
    <div className="space-y-8">
      <div>
        <SystemManagementTitle />
        
        <SystemManagementTabs activeTab="user" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <UserManagementContent profiles={profiles} errors={errors} dealers={dealers || []} />
        </div>
      </div>
    </div>
  )
}

