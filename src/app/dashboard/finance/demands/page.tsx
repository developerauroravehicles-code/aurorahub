import { createClient } from '@/lib/supabase/server'
import { DemandActions } from './demand-actions'
import { format } from 'date-fns'

export default async function FinanceDemandsPage() {
  const supabase = await createClient()
  
  const { data: demands } = await supabase
    .from('demands')
    .select('*, dealers(name)')
    .eq('status', 'pending_finance')
    .order('created_at', { ascending: true })

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-6">Pending Approvals</h1>
      <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
         {(!demands || demands.length === 0) && (
             <p className="p-4 text-gray-400 text-center">No pending demands.</p>
         )}
         <ul className="divide-y divide-gray-800">
             {demands?.map(demand => (
                 <li key={demand.id} className="p-4 sm:px-6 hover:bg-white/5 transition-colors">
                     <div className="flex items-center justify-between">
                         <div>
                             <p className="text-lg font-medium text-[#C27E00]">
                                 {demand.customer_firstname} {demand.customer_lastname}
                             </p>
                             <p className="text-sm text-gray-400">
                                 {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                             </p>
                             <p className="text-sm text-gray-400">
                                 Appointment: <span className="font-semibold text-white">{format(new Date(demand.appointment_date), 'PPP p')}</span>
                             </p>
                             <p className="text-sm text-gray-500 mt-1">
                                 Dealer: {(demand.dealers as any)?.name}
                             </p>
                         </div>
                         <DemandActions demandId={demand.id} />
                     </div>
                 </li>
             ))}
         </ul>
      </div>
    </div>
  )
}

