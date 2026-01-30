import { createClient } from '@/lib/supabase/server'

export default async function AdminReportsPage() {
  const supabase = await createClient()
  
  // Fetch basic stats
  const { data: demands } = await supabase
    .from('demands')
    .select('status, created_at')

  const stats = {
    total: demands?.length || 0,
    pending: demands?.filter(d => d.status === 'pending_finance').length || 0,
    approved: demands?.filter(d => d.status === 'approved').length || 0,
    completed: demands?.filter(d => d.status === 'completed').length || 0,
    cancelled: demands?.filter(d => d.status === 'cancelled').length || 0,
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-4 text-white">Reports</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Total Demands</h3>
            <p className="text-3xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Completed</h3>
            <p className="text-3xl font-bold text-[#C27E00]">{stats.completed}</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Pending</h3>
            <p className="text-3xl font-bold text-yellow-400">{stats.pending}</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <p className="text-gray-400">Detailed reports coming soon...</p>
        </div>
      </div>
    </div>
  )
}
