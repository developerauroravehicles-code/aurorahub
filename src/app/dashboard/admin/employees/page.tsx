import { createClient } from '@/lib/supabase/server'
import { createEmployee } from './actions'
import Link from 'next/link'
import { ResetPasswordButton } from './reset-password-button'

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

      <div className="bg-white/5 p-6 rounded-lg border border-gray-800 shadow max-w-2xl">
          <h2 className="text-lg font-medium mb-4 text-white">Add New Employee</h2>
          <form action={createEmployee} className="space-y-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-300">Full Name</label>
                  <input name="fullName" required className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-300">Phone</label>
                  <input name="phone" className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]" />
              </div>
              
              <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-300">Email</label>
                  <input name="email" type="email" required className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-300">Password</label>
                  <input name="password" type="password" required className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]" />
              </div>

              <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-300">Role</label>
                  <select name="role" required className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]">
                      <option value="sales" className="bg-black text-white">Sales</option>
                      <option value="finance" className="bg-black text-white">Finance</option>
                      <option value="specialist" className="bg-black text-white">Specialist</option>
                      <option value="aurora_manager" className="bg-black text-white">Aurora Manager</option>
                      <option value="general_manager" className="bg-black text-white">General Manager</option>
                  </select>
              </div>

              <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-300">Dealer</label>
                  <select name="dealerId" className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]">
                      <option value="" className="bg-black text-white">None (HQ)</option>
                      {dealers?.map(d => (
                          <option key={d.id} value={d.id} className="bg-black text-white">{d.name}</option>
                      ))}
                  </select>
              </div>

              <div className="col-span-2">
                  <button className="bg-[#C27E00] text-white px-4 py-2 rounded w-full sm:w-auto hover:bg-[#a06900] transition-colors">Create Employee</button>
              </div>
          </form>
      </div>
    </div>
  )
}

