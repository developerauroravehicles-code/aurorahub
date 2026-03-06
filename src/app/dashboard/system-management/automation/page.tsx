import { SystemManagementTabs } from '../system-management-tabs'
import { SystemManagementTitle } from '../system-management-title'
import { AutomationContent } from './automation-content'

export const dynamic = 'force-dynamic'

export default async function AutomationPage() {
  return (
    <div className="space-y-8">
      <div>
        <SystemManagementTitle />

        <SystemManagementTabs activeTab="automation" />

        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <AutomationContent />
        </div>
      </div>
    </div>
  )
}
