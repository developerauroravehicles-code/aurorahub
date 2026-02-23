import { SystemManagementTabs } from '../system-management-tabs'
import { SMSManagementContent } from './sms-management-content'

export const dynamic = 'force-dynamic'

export default async function SMSManagementPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6 text-white">System Management</h1>

        <SystemManagementTabs activeTab="sms" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <SMSManagementContent />
        </div>
      </div>
    </div>
  )
}
