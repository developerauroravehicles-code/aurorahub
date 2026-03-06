import { getSessionLogs } from './actions'
import { SessionsContent } from './sessions-content'

export const dynamic = 'force-dynamic'

export default async function SessionsPage() {
  const logs = await getSessionLogs()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mt-4">Session / Login History</h2>
        <p className="text-gray-400 text-sm">
          List of platform login, logout and identity events. Successful and failed login attempts are recorded.
        </p>
      </div>
      <SessionsContent logs={logs} />
    </div>
  )
}
