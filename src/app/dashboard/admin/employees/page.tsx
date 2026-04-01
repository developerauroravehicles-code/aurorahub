import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ResetPasswordButton } from './reset-password-button'
import { CreateEmployeeForm } from './create-employee-form'
import { EmployeesDealerFilter } from './employees-dealer-filter'

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ dealer?: string }>
}) {
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

  // IT role does not need access to Employees section
  if (currentUserProfile.role === 'it') {
    redirect('/dashboard/identity')
  }

  // General Manager does not have access to Employees
  if (currentUserProfile.role === 'general_manager') {
    redirect('/dashboard')
  }

  const params = await searchParams
  const dealerFilter = params.dealer && params.dealer !== 'platform' ? params.dealer : 'platform'

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

  // If platform admin (Aurora Manager, HR): support dealer filter
  if (['aurora_manager', 'hr'].includes(currentUserProfile.role ?? '')) {
    if (dealerFilter === 'platform') {
      query = query.is('dealer_id', null)
    } else {
      query = query
        .eq('dealer_id', dealerFilter)
        .in('role', ['sales', 'finance'])
    }
  }

  const { data: employees } = await query

  // For specialists, fetch their assigned dealers (only if Aurora Manager/HR and platform view)
  const specialistIds = employees?.filter(e => e.role === 'specialist').map(e => e.id) || []
  const { data: specialistDealers } = (specialistIds.length > 0 && ['aurora_manager', 'hr'].includes(currentUserProfile.role ?? '') && dealerFilter === 'platform')
    ? await supabase
        .from('specialist_dealers')
        .select('specialist_id, dealer_id, dealers(name)')
        .in('specialist_id', specialistIds)
    : { data: null }

  // Create a map of specialist_id -> dealers[] (only for Aurora Manager/HR, platform view)
  const specialistDealersMap = new Map<string, Array<{ name: string }>>()
  if (['aurora_manager', 'hr'].includes(currentUserProfile.role ?? '') && dealerFilter === 'platform') {
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

  // Fetch dealers for dropdown (for Aurora Manager/HR dealer filter)
  let dealersQuery = supabase.from('dealers').select('id, name').order('name')
  
  // If General Manager, filter dropdown to own dealer
  if (currentUserProfile.role === 'general_manager') {
    dealersQuery = dealersQuery.eq('id', currentUserProfile.dealer_id)
  }

  const { data: dealers } = await dealersQuery

  const showDealerFilter = ['aurora_manager', 'hr'].includes(currentUserProfile.role ?? '')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-4 text-zinc-900 dark:text-white">Employees</h1>
        {showDealerFilter && (
          <EmployeesDealerFilter
            dealers={dealers ?? []}
            selectedDealerId={dealerFilter}
          />
        )}
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 shadow overflow-hidden">
            <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
                {employees?.map(e => (
                    <li key={e.id} className="px-4 py-4 hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-zinc-900 dark:text-white">
                                    {e.role === 'specialist' ? (
                                        <Link href={`/dashboard/admin/employees/${e.id}`} className="hover:text-[#C27E00] hover:underline transition-colors">
                                            {e.full_name}
                                        </Link>
                                    ) : (
                                        e.full_name
                                    )}
                                </p>
                                <p className="text-sm text-zinc-500 dark:text-gray-400 capitalize">{e.role === 'specialist' ? 'Technical Support' : e.role.replace('_', ' ')}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right text-sm text-zinc-500 dark:text-gray-400">
                                    {e.role === 'specialist' && ['aurora_manager', 'hr'].includes(currentUserProfile.role ?? '') && specialistDealersMap.has(e.id) ? (
                                        <p className="text-[#C27E00]">
                                          {specialistDealersMap.get(e.id)?.map(d => d.name).join(', ') || 'No dealers assigned'}
                                        </p>
                                      ) : e.role === 'specialist' ? (
                                        <p className="text-zinc-600 dark:text-gray-600">—</p>
                                      ) : (
                                        <p>{(e.dealers as any)?.name || 'Platform'}</p>
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

      {['aurora_manager', 'hr', 'general_manager'].includes(currentUserProfile.role ?? '') && (
        <CreateEmployeeForm
          dealers={dealers || []}
          currentUserRole={currentUserProfile.role}
          defaultDealerId={currentUserProfile.role === 'general_manager' ? currentUserProfile.dealer_id ?? undefined : undefined}
        />
      )}
    </div>
  )
}

