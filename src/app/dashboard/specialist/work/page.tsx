import { createClient } from '@/lib/supabase/server'
import { CompleteButton } from './complete-button'
import { format } from 'date-fns'

export default async function SpecialistWorkPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const { data: profile } = await supabase.from('profiles').select('dealer_id').eq('id', user.id).single()
    
    if (!profile) return <div>Profile error</div>

    const { data: demands } = await supabase
        .from('demands')
        .select('*')
        .eq('dealer_id', profile.dealer_id)
        .eq('status', 'approved')
        .order('appointment_date', { ascending: true })

    return (
        <div>
           <h1 className="text-2xl font-semibold mb-6 text-white">Work List</h1>
           <div className="space-y-4">
                {(!demands || demands.length === 0) && <p className="text-gray-500">No active jobs.</p>}
                {demands?.map(demand => (
                    <div key={demand.id} className="bg-white/5 border border-gray-800 p-6 rounded-lg shadow flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-white/10 transition-colors">
                        <div className="mb-4 sm:mb-0">
                            <h3 className="text-lg font-medium text-white">{demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}</h3>
                            <p className="text-gray-400">{demand.camera_model}</p>
                            <p className="mt-1 font-semibold text-[#C27E00]">
                                {format(new Date(demand.appointment_date), 'PPP p')}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">Customer: {demand.customer_firstname} {demand.customer_lastname} ({demand.customer_phone})</p>
                        </div>
                        <CompleteButton demandId={demand.id} />
                    </div>
                ))}
           </div>
        </div>
    )
}

