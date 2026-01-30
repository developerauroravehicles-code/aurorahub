import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

export default async function DemandsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // Get dealer_id
  const { data: profile } = await supabase.from('profiles').select('dealer_id').eq('id', user.id).single()
  
  if (!profile) return <div>Profile error</div>

  // Fetch demands for this dealer
  const { data: demands } = await supabase
    .from('demands')
    .select('*')
    .eq('dealer_id', profile.dealer_id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-white">Demands</h1>
        <Link href="/dashboard/sales/demands/new" className="flex items-center bg-[#C27E00] text-white px-4 py-2 rounded-md hover:bg-[#a06900] transition-colors">
            <Plus className="w-4 h-4 mr-2" />
            New Demand
        </Link>
      </div>

      <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
        <ul className="divide-y divide-gray-800">
            {demands?.length === 0 && <li className="p-4 text-center text-gray-400">No demands found.</li>}
            {demands?.map((demand) => (
                <li key={demand.id} className="hover:bg-white/5 transition-colors">
                    <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-[#C27E00] truncate">{demand.customer_firstname} {demand.customer_lastname}</p>
                            <div className="ml-2 flex-shrink-0 flex">
                                <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-white/10 text-gray-300 capitalize border border-gray-700">
                                    {demand.status.replace('_', ' ')}
                                </p>
                            </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                            <div className="sm:flex">
                                <p className="flex items-center text-sm text-gray-400">
                                    {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                                </p>
                            </div>
                            <div className="mt-2 flex items-center text-sm text-gray-400 sm:mt-0">
                                <p>
                                    Appointment: {format(new Date(demand.appointment_date), 'PPP p')}
                                </p>
                            </div>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
      </div>
    </div>
  )
}

