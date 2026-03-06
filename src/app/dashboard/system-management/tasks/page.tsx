export const dynamic = 'force-dynamic'

export default function TasksPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mt-4">Tasks</h2>
        <p className="text-gray-400 text-sm">Manage IT tasks and tracking list.</p>
      </div>
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">Tasks module will be added soon.</p>
          <p className="text-sm">Tasks such as routine maintenance, deployment, config changes will be tracked here.</p>
        </div>
      </div>
    </div>
  )
}
