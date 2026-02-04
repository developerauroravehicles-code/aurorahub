import { getSystemData } from '../actions'
import { SystemManagementTabs } from '../system-management-tabs'
import { UserManagementContent } from './user-management-content'

export const dynamic = 'force-dynamic'

export default async function UserManagementPage() {
  const { profiles, errors } = await getSystemData()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6 text-white">System Management</h1>
        
        <SystemManagementTabs activeTab="user" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <UserManagementContent profiles={profiles} errors={errors} />
        </div>
      </div>
    </div>
  )
}

