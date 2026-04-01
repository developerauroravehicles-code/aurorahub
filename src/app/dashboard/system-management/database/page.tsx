import { getSystemData } from '../actions'
import { SystemManagementTabs } from '../system-management-tabs'
import { SystemManagementTitle } from '../system-management-title'
import { DatabaseManagementContent } from './database-management-content'

export const dynamic = 'force-dynamic'

export default async function DatabaseManagementPage() {
  const { dealers, profiles, errors } = await getSystemData()

  return (
    <div className="space-y-8">
      <div>
        <SystemManagementTitle />
        
        <SystemManagementTabs activeTab="database" />

        {/* Tab Content */}
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <DatabaseManagementContent dealers={dealers} profiles={profiles} errors={errors} />
        </div>
      </div>
    </div>
  )
}

