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

  // If General Manager, filter by own dealer and only show sales and finance
  if (currentUserProfile.role === 'general_manager') {
    query = query
      .eq('dealer_id', currentUserProfile.dealer_id)
      .in('role', ['sales', 'finance'])
  }

  // If Aurora Manager, filter to show only Specialists
  if (currentUserProfile.role === 'aurora_manager') {
    query = query.eq('role', 'specialist')
  }

  const { data: employees } = await query

  // For specialists, fetch their assigned dealers (only if Aurora Manager)
  const specialistIds = employees?.filter(e => e.role === 'specialist').map(e => e.id) || []
  const { data: specialistDealers } = (specialistIds.length > 0 && currentUserProfile.role === 'aurora_manager')
    ? await supabase
        .from('specialist_dealers')
        .select('specialist_id, dealer_id, dealers(name)')
        .in('specialist_id', specialistIds)
    : { data: null }

  // Create a map of specialist_id -> dealers[] (only for Aurora Manager)
  const specialistDealersMap = new Map<string, Array<{ name: string }>>()
  if (currentUserProfile.role === 'aurora_manager') {
    specialistDealers?.forEach(sd => {
      if (!specialistDealersMap.has(sd.specialist_id)) {
        specialistDealersMap.set(sd.specialist_id, [])
      }
      if (sd.dealers) {
        // Supabase returns dealers as an object, not an array
        // Use unknown first to avoid type error
        const dealersData = sd.dealers as unknown as { name: string }
        if (dealersData?.name) {
          specialistDealersMap.get(sd.specialist_id)?.push({ name: dealersData.name })
        }
      }
    })
  }

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
                                    {e.role === 'specialist' && currentUserProfile.role === 'aurora_manager' && specialistDealersMap.has(e.id) ? (
                                        <p className="text-[#C27E00]">
                                          {specialistDealersMap.get(e.id)?.map(d => d.name).join(', ') || 'No dealers assigned'}
                                        </p>
                                      ) : e.role === 'specialist' ? (
                                        <p className="text-gray-600">—</p>
                                      ) : (
                                        <p>{(e.dealers as any)?.name || 'Aurora HQ'}</p>
                                      )}
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

      <CreateEmployeeForm dealers={dealers || []} currentUserRole={currentUserProfile.role} />
    </div>
  )
}

