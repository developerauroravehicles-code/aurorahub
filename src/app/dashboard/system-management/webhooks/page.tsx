import { WebhooksContent } from './webhooks-content'

export const dynamic = 'force-dynamic'

export default function WebhooksPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mt-4">Webhooks</h2>
        <p className="text-gray-400 text-sm">
          Configure outgoing webhook URLs. HTTP requests are sent when events are triggered.
        </p>
      </div>
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <WebhooksContent />
      </div>
    </div>
  )
}
