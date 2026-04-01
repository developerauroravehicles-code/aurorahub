import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { LeaveRequestForm } from './leave-request-form'
import { LeaveActions } from './leave-actions'

export const dynamic = 'force-dynamic'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  personal: 'Personal',
  bereavement: 'Bereavement',
  parental: 'Parental',
  other: 'Other',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
  approved: 'bg-green-900/50 text-green-300 border-green-800',
  rejected: 'bg-red-900/50 text-red-300 border-red-800',
}

export default async function LeavePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: currentProfile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }
  const isHR = currentProfile?.role === 'hr'

  const { data: leaveRequests, error: leaveError } = await supabase
    .from('leave_requests')
    .select('id, profile_id, leave_type, start_date, end_date, status, notes, created_at, profiles!leave_requests_profile_id_fkey(full_name)')
    .order('created_at', { ascending: false })

  // Employees for form: personnel (platform) with profile_id, fallback to profiles
  const { data: personnelList } = await supabase
    .from('personnel')
    .select('profile_id, full_name')
    .is('dealer_id', null)
    .not('profile_id', 'is', null)
    .order('full_name')
  const { data: profileList } = await supabase
    .from('profiles')
    .select('id, full_name')
    .is('dealer_id', null)
    .order('full_name')

  const employeesMap = new Map<string, string>()
  personnelList?.forEach((p) => {
    if (p.profile_id) employeesMap.set(p.profile_id, p.full_name ?? '')
  })
  profileList?.forEach((p) => {
    if (!employeesMap.has(p.id)) employeesMap.set(p.id, p.full_name ?? '')
  })
  const employees = Array.from(employeesMap.entries())
    .map(([id, full_name]) => ({ id, full_name }))
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Leave Management</h1>
        <p className="text-zinc-500 dark:text-gray-400">Manage platform employee leave requests.</p>
      </div>

      {isHR && <LeaveRequestForm employees={employees || []} />}

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Leave Requests</h2>
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                {leaveRequests?.map((lr) => (
                  <tr key={lr.id} className="hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-zinc-900 dark:text-white font-medium">
                        {(lr.profiles as { full_name?: string } | null)?.full_name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-gray-300">
                      {LEAVE_TYPE_LABELS[lr.leave_type] ?? lr.leave_type}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-gray-400">
                      {format(new Date(lr.start_date), 'MMM d, yyyy')} – {format(new Date(lr.end_date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_COLORS[lr.status] ?? 'bg-gray-800 text-zinc-600 dark:text-gray-300'}`}>
                        {lr.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-gray-500 text-sm max-w-[200px] truncate">
                      {lr.notes || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {lr.status === 'pending' && (
                        <LeaveActions requestId={lr.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leaveError && (
            <div className="p-8 text-center text-red-400">
              Error loading leave requests: {leaveError.message}
            </div>
          )}
          {!leaveError && (!leaveRequests || leaveRequests.length === 0) && (
            <div className="p-8 text-center text-zinc-500 dark:text-gray-400">No leave requests yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}
