import { SystemManagementTabs } from '../system-management-tabs'
import { AutomationContent } from './automation-content'

export const dynamic = 'force-dynamic'

export default async function AutomationPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6 text-white">System Management</h1>

        <SystemManagementTabs activeTab="automation" />

        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <AutomationContent />
        </div>
      </div>
    </div>
  )
}
