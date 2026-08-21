import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PersonnelFilters } from './personnel-filters'

const WORKER_TYPE_LABELS: Record<string, string> = {
  employee: 'Employee',
  contractor: 'Contractor',
  installer_technician: 'Installer Technician',
  dealer_staff: 'Dealer Staff',
  regional_manager: 'Regional Manager',
  support_staff: 'Support Staff',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  suspended: 'Suspended',
  onboarding: 'Onboarding',
  pending_verification: 'Pending Verification',
  terminated: 'Terminated',
}

export default async function PersonnelPage({
  searchParams,
}: {
  searchParams: Promise<{ worker_type?: string; status?: string; dealer?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  let query = supabase
    .from('personnel')
    .select(`
      id, worker_id, full_name, worker_type, status, position, phone, email, start_date,
      dealers(name),
      hr_departments(name),
      hr_regions(name)
    `)
    .order('full_name', { ascending: true })

  if (params.worker_type) query = query.eq('worker_type', params.worker_type)
  if (params.status) query = query.eq('status', params.status)
  if (params.dealer === 'platform') query = query.is('dealer_id', null)
  else if (params.dealer) query = query.eq('dealer_id', params.dealer)

  const { data: personnel } = await query
  const { data: dealers } = await supabase.from('dealers').select('id, name').order('name')

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Personnel Registry</h1>
          <p className="text-zinc-500 dark:text-gray-400">Master record for all workers: employees, contractors, installers, dealer staff.</p>
        </div>
        <Link
          href="/dashboard/hr/personnel/new"
          className="px-4 py-2 rounded-md bg-[#C27E00] text-white font-medium hover:bg-[#a06900] transition-colors"
        >
          Add Person
        </Link>
      </div>

      <PersonnelFilters dealers={dealers || []} currentType={params.worker_type} currentStatus={params.status} currentDealer={params.dealer} />

      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Worker ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Position</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Dealer / Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Start Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
              {personnel?.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-zinc-500 dark:text-gray-400">{p.worker_id || '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/hr/personnel/${p.id}`} className="font-medium text-white hover:text-[#C27E00]">
                      {p.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-gray-300">{WORKER_TYPE_LABELS[p.worker_type] ?? p.worker_type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs border ${
                      p.status === 'active' ? 'bg-green-900/50 text-green-300 border-green-800' :
                      p.status === 'onboarding' ? 'bg-yellow-900/50 text-yellow-300 border-yellow-800' :
                      p.status === 'terminated' ? 'bg-red-950/60 text-red-300 border-red-900' :
                      p.status === 'suspended' ? 'bg-red-900/50 text-red-300 border-red-800' :
                      'bg-gray-800 text-zinc-600 dark:text-gray-300 border-zinc-300 dark:border-gray-700'
                    }`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500 dark:text-gray-400">{p.position || '—'}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500 dark:text-gray-400">
                    {(p.dealers as { name?: string } | null)?.name ?? 'Platform'}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500 dark:text-gray-400">
                    {p.start_date ? new Date(p.start_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/hr/personnel/${p.id}`} className="text-[#C27E00] hover:text-[#a06900] text-sm">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!personnel || personnel.length === 0) && (
          <div className="p-8 text-center text-zinc-500 dark:text-gray-400">No personnel records. Add your first person to get started.</div>
        )}
      </div>
    </div>
  )
}
