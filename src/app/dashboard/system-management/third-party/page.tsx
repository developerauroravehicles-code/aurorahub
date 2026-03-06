export const dynamic = 'force-dynamic'

export default function ThirdPartyPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mt-4">Third Party Services</h2>
        <p className="text-gray-400 text-sm">
          Manage third-party service subscriptions and API keys.
        </p>
      </div>
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">Third Party Services management coming soon.</p>
          <p className="text-sm">Services such as Twilio, SendGrid, Supabase, Google Workspace will be listed here.</p>
        </div>
      </div>
    </div>
  )
}
