import { getSystemData } from '../actions'
import { SystemManagementTabs } from '../system-management-tabs'
import { DealerManagementContent } from './dealer-management-content'

export const dynamic = 'force-dynamic'

export default async function DealerManagementPage() {
  const { dealers, errors } = await getSystemData()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6 text-white">System Management</h1>
        
        <SystemManagementTabs activeTab="dealer" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <DealerManagementContent dealers={dealers} errors={errors} />
        </div>
      </div>
    </div>
  )
}

