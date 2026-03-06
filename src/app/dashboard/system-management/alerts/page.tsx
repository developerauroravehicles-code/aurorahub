import { AlertsContent } from './alerts-content'

export const dynamic = 'force-dynamic'

export default function AlertsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mt-4">Alerts</h2>
        <p className="text-gray-400 text-sm">Configure alert rules. Emails are sent to IT and Aurora Manager on critical events.</p>
      </div>
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <AlertsContent />
      </div>
    </div>
  )
}
