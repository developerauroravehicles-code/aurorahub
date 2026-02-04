import { SystemManagementTabs } from '../system-management-tabs'
import { APIManagementContent } from './api-management-content'

export const dynamic = 'force-dynamic'

export default async function APIManagementPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6 text-white">System Management</h1>
        
        <SystemManagementTabs activeTab="api" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <APIManagementContent />
        </div>
      </div>
    </div>
  )
}

