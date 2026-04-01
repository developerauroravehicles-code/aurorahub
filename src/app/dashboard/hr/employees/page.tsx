import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { EmployeesFilters } from './employees-filters'

const ROLE_LABELS: Record<string, string> = {
  sales: 'Sales',
  finance: 'Finance',
  specialist: 'Technical Support',
  general_manager: 'General Manager',
  aurora_manager: 'Aurora Manager',
  hr: 'HR',
  it: 'IT',
}

const WORKER_TYPE_LABELS: Record<string, string> = {
  employee: 'Employee',
  contractor: 'Contractor',
  installer_technician: 'Installer Technician',
  dealer_staff: 'Dealer Staff',
  regional_manager: 'Regional Manager',
  support_staff: 'Support Staff',
}

export default async function HREmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; dealer?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  // Platform employees from personnel registry (master HR source)
  let query = supabase
    .from('personnel')
    .select('id, worker_id, full_name, platform_role, worker_type, phone, email, position, status, created_at')
    .is('dealer_id', null)

  if (params.role) {
    query = query.eq('platform_role', params.role)
  }

  const { data: rawEmployees } = await query.order('created_at', { ascending: false })

  // IT role at end; others by full_name. Newest created first within each group.
  const employees = [...(rawEmployees || [])].sort((a, b) => {
    const aIsIt = a.platform_role === 'it' ? 1 : 0
    const bIsIt = b.platform_role === 'it' ? 1 : 0
    if (aIsIt !== bIsIt) return aIsIt - bIsIt
    const aCreated = (a as { created_at?: string }).created_at || ''
    const bCreated = (b as { created_at?: string }).created_at || ''
    return bCreated.localeCompare(aCreated) || (a.full_name || '').localeCompare(b.full_name || '')
  })

  const roleCounts = (employees || []).reduce(
    (acc, e) => {
      const role = e.platform_role || e.worker_type || 'other'
      acc[role] = (acc[role] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Platform Employees</h1>
        <p className="text-zinc-500 dark:text-gray-400">Platform workforce from personnel registry. Filter by role.</p>
      </div>

      <EmployeesFilters currentRole={params.role} />

      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Role / Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Position</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
              {employees?.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/hr/personnel/${e.id}`}
                      className="font-medium text-[#C27E00] hover:text-[#a06900] transition-colors"
                    >
                      {e.full_name || '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-zinc-600 dark:text-gray-300">
                      {(e.platform_role && ROLE_LABELS[e.platform_role]) || WORKER_TYPE_LABELS[e.worker_type] || e.platform_role || e.worker_type || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-zinc-500 dark:text-gray-400">{e.position || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-zinc-500 dark:text-gray-400">{e.phone || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-zinc-500 dark:text-gray-400 capitalize">{e.status || '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!employees || employees.length === 0) && (
          <div className="p-8 text-center text-zinc-500 dark:text-gray-400">No employees match the filters.</div>
        )}
      </div>

      {Object.keys(roleCounts).length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-zinc-500 dark:text-gray-400">
          {Object.entries(roleCounts).map(([role, count]) => (
            <span key={role}>
              {ROLE_LABELS[role] ?? WORKER_TYPE_LABELS[role] ?? role}: {count}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
