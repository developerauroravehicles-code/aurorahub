import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function AdminDemandsPage() {
  const supabase = await createClient()
  
  const { data: demands } = await supabase
    .from('demands')
    .select('*, dealers(name), profiles!demands_created_by_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-4 text-white">All Demands</h1>
        <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
          {(!demands || demands.length === 0) && (
            <p className="p-4 text-gray-500 text-center">No demands found.</p>
          )}
          <ul className="divide-y divide-gray-800">
            {demands?.map(demand => (
              <li key={demand.id} className="p-4 hover:bg-white/5 transition-colors">
                <Link href={`/dashboard/admin/demands/${demand.id}`} className="block">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-lg font-medium text-[#C27E00] hover:text-[#a06900] transition-colors">
                        {demand.customer_firstname} {demand.customer_lastname}
                      </p>
                      <p className="text-sm text-gray-400">
                        {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                      </p>
                      <p className="text-sm text-gray-500">
                        Appointment: {format(new Date(demand.appointment_date), 'PPP p')}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Dealer: {(demand.dealers as any)?.name} | Created by: {(demand.profiles as any)?.full_name}
                      </p>
                    </div>
                    <div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                        demand.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        demand.status === 'approved' ? 'bg-blue-500/20 text-blue-400' :
                        demand.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {demand.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
