import { SystemManagementTabs } from '../system-management-tabs'
import { SystemManagementTitle } from '../system-management-title'
import { SMSManagementContent } from './sms-management-content'

export const dynamic = 'force-dynamic'

export default async function SMSManagementPage() {
  return (
    <div className="space-y-8">
      <div>
        <SystemManagementTitle />

        <SystemManagementTabs activeTab="sms" />

        {/* Tab Content */}
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <SMSManagementContent />
        </div>
      </div>
    </div>
  )
}
