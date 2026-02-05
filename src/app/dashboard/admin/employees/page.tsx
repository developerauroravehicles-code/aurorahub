import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ResetPasswordButton } from './reset-password-button'
import { CreateEmployeeForm } from './create-employee-form'

export default async function EmployeesPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch current user profile to determine permissions
  const { data: currentUserProfile } = await supabase
    .from('profiles')
    .select('role, dealer_id')
    .eq('id', user.id)
    .single()

  if (!currentUserProfile) return <div>Access Denied</div>

  // Fetch profiles with dealer info
  let query = supabase
    .from('profiles')
    .select('*, dealers(name)')
    .order('created_at', { ascending: false })

  // If General Manager, filter by own dealer
  if (currentUserProfile.role === 'general_manager') {
    query = query.eq('dealer_id', currentUserProfile.dealer_id)
  }

  // If Aurora Manager, filter to show only Specialists
  if (currentUserProfile.role === 'aurora_manager') {
    query = query.eq('role', 'specialist')
  }

  const { data: employees } = await query

  // Fetch dealers for dropdown
  let dealersQuery = supabase.from('dealers').select('id, name').order('name')
  
  // If General Manager, filter dropdown to own dealer
  if (currentUserProfile.role === 'general_manager') {
    dealersQuery = dealersQuery.eq('id', currentUserProfile.dealer_id)
  }

  const { data: dealers } = await dealersQuery

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-4 text-white">Employees</h1>
        <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
            <ul className="divide-y divide-gray-800">
                {employees?.map(e => (
                    <li key={e.id} className="px-4 py-4 hover:bg-white/5 transition-colors">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-white">
                                    {e.role === 'specialist' ? (
                                        <Link href={`/dashboard/admin/employees/${e.id}`} className="hover:text-[#C27E00] hover:underline transition-colors">
                                            {e.full_name}
                                        </Link>
                                    ) : (
                                        e.full_name
                                    )}
                                </p>
                                <p className="text-sm text-gray-400 capitalize">{e.role.replace('_', ' ')}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right text-sm text-gray-400">
                                    <p>{(e.dealers as any)?.name || 'Aurora HQ'}</p>
                                    <p>{e.phone}</p>
                                </div>
                                <ResetPasswordButton userId={e.id} userName={e.full_name} />
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
      </div>

      <CreateEmployeeForm dealers={dealers || []} />
    </div>
  )
}

