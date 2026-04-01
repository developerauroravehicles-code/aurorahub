import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { RecruitmentPositionForm } from './recruitment-position-form'
import { RecruitmentPositionActions } from './recruitment-position-actions'

const ROLE_LABELS: Record<string, string> = {
  sales: 'Sales',
  finance: 'Finance',
  specialist: 'Technical Support',
  general_manager: 'General Manager',
  aurora_manager: 'Aurora Manager',
  hr: 'HR',
  it: 'IT',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-900/50 text-blue-300 border-blue-800',
  interviewing: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
  offer: 'bg-amber-900/50 text-amber-300 border-amber-800',
  filled: 'bg-green-900/50 text-green-300 border-green-800',
  cancelled: 'bg-red-900/50 text-red-300 border-red-800',
}

export default async function RecruitmentPage() {
  const supabase = await createClient()

  const { data: positions } = await supabase
    .from('recruitment_positions')
    .select('id, title, role, status, description, created_at, filled_by(full_name)')
    .is('dealer_id', null)
    .order('created_at', { ascending: false })

  const { data: employees } = await supabase
    .from('profiles')
    .select('id, full_name')
    .is('dealer_id', null)
    .order('full_name')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Recruitment</h1>
        <p className="text-zinc-500 dark:text-gray-400">Manage platform positions and hiring pipeline.</p>
      </div>

      <RecruitmentPositionForm />

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Positions</h2>
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Filled By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                {positions?.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-900 dark:text-white">{p.title}</span>
                      {p.description && (
                        <p className="text-xs text-zinc-500 dark:text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-gray-300">
                      {ROLE_LABELS[p.role] ?? p.role}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_COLORS[p.status] ?? 'bg-gray-800 text-zinc-600 dark:text-gray-300'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-gray-400">
                      {(p.filled_by as { full_name?: string } | null)?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-gray-500 text-sm">
                      {format(new Date(p.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      {!['filled', 'cancelled'].includes(p.status) && (
                        <RecruitmentPositionActions positionId={p.id} status={p.status} employees={employees || []} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!positions || positions.length === 0) && (
            <div className="p-8 text-center text-zinc-500 dark:text-gray-400">No positions yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}
