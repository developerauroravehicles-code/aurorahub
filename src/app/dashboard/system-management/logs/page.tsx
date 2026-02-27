import { SystemManagementTabs } from '../system-management-tabs'
import { LogsContent } from './logs-content'

export const dynamic = 'force-dynamic'

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const initialType = type === 'demands' ? 'demands' : type === 'mail' ? 'mail' : 'sms'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6 text-white">System Management</h1>
        <SystemManagementTabs
          activeTab={
            initialType === 'demands' ? 'logs-demands' : initialType === 'mail' ? 'logs-mail' : 'logs-sms'
          }
        />
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6 mt-6">
          <LogsContent initialType={initialType} />
        </div>
      </div>
    </div>
  )
}
