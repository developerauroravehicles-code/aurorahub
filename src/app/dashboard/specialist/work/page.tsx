import { createClient } from '@/lib/supabase/server'
import { WorkActions } from './work-actions'
import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

type WorkDemandRow = {
  id: string
  customer_firstname: string
  customer_lastname: string
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  camera_model: string
  appointment_date: string
  customer_phone: string
  created_at: string
  address?: string | null
  assigned_specialist_id?: string | null
  dealers?: { region_codes?: { timezones?: { name: string } } } | null
  profiles?: { full_name: string } | null
}

export default async function SpecialistWorkPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const { data: profile } = await supabase.from('profiles').select('dealer_id').eq('id', user.id).single()
    
    if (!profile) return <div className="text-white">Profile error</div>

    // Specialist can see demands from dealers assigned via specialist_dealers, or fallback to profile.dealer_id
    const { data: specialistDealers } = await supabase
        .from('specialist_dealers')
        .select('dealer_id')
        .eq('specialist_id', user.id)
    const dealerIds: string[] = (specialistDealers?.length ?? 0) > 0
        ? (specialistDealers!.map((sd: { dealer_id: string }) => sd.dealer_id))
        : (profile.dealer_id ? [profile.dealer_id] : [])

    // Get unassigned work (work pool) — only from dealers this specialist can serve
    let unassignedWork: WorkDemandRow[] = []
    if (dealerIds.length > 0) {
        const { data } = await supabase
            .from('demands')
            .select('*, profiles!demands_assigned_specialist_id_fkey(full_name), dealers(region_codes(timezone_id, timezones(name)))')
            .in('dealer_id', dealerIds)
            .eq('status', 'approved')
            .is('assigned_specialist_id', null)
            .order('appointment_date', { ascending: true })
        unassignedWork = (data ?? []) as WorkDemandRow[]
    }

    // Get assigned work for current user
    const { data: myAssignedWork } = await supabase
        .from('demands')
        .select('*, profiles!demands_assigned_specialist_id_fkey(full_name), dealers(region_codes(timezone_id, timezones(name)))')
        .eq('assigned_specialist_id', user.id)
        .eq('status', 'approved')
        .order('appointment_date', { ascending: true })

    // Get all assigned work (for reference) — only from dealers this specialist can serve
    let allAssignedWork: WorkDemandRow[] = []
    if (dealerIds.length > 0) {
        const { data } = await supabase
            .from('demands')
            .select('*, profiles!demands_assigned_specialist_id_fkey(full_name), dealers(region_codes(timezone_id, timezones(name)))')
            .in('dealer_id', dealerIds)
            .eq('status', 'approved')
            .not('assigned_specialist_id', 'is', null)
            .order('appointment_date', { ascending: true })
        allAssignedWork = (data ?? []) as WorkDemandRow[]
    }

    const getDealerTimezone = (d: { dealers?: { region_codes?: { timezones?: { name: string } } } | null }) =>
      (d.dealers as { region_codes?: { timezones?: { name: string } } } | null)?.region_codes?.timezones?.name ?? null
    const formatAppointment = (appointmentDate: string, timezoneName: string | null) =>
      timezoneName
        ? formatInTimeZone(new Date(appointmentDate), timezoneName, 'PPP p')
        : format(new Date(appointmentDate), 'PPP p')

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-semibold text-white mb-2">Work Management</h1>
                <p className="text-gray-400">Assign work to yourself from the pool or manage your assigned work.</p>
            </div>

            {/* My Assigned Work */}
            {myAssignedWork && myAssignedWork.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold text-white mb-4">My Assigned Work ({myAssignedWork.length})</h2>
                    <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
                        <ul className="divide-y divide-gray-800">
                            {myAssignedWork.map(demand => (
                                <li key={demand.id} className="p-4 sm:px-6 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <p className="text-lg font-medium text-[#C27E00]">
                                                    {demand.customer_firstname} {demand.customer_lastname}
                                                </p>
                                                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-800">
                                                    ASSIGNED TO ME
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400">
                                                {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                                            </p>
                                            <p className="text-sm text-gray-400">
                                                Camera: {demand.camera_model}
                                            </p>
                                            <p className="text-sm text-gray-400">
                                                Appointment: <span className="font-semibold text-white">{formatAppointment(demand.appointment_date, getDealerTimezone(demand))}</span>
                                            </p>
                                            {demand.address && (
                                                <p className="text-sm text-gray-500 mt-1">
                                                    Address: {demand.address}
                                                </p>
                                            )}
                                            <p className="text-sm text-gray-500 mt-1">
                                                Customer: {demand.customer_phone}
                                            </p>
                                        </div>
                                        <WorkActions demandId={demand.id} isAssigned={true} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* Work Pool - Unassigned Work */}
            <div>
                <h2 className="text-xl font-semibold text-white mb-4">
                    Work Pool - Unassigned ({unassignedWork?.length || 0})
                </h2>
                <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
                    {(!unassignedWork || unassignedWork.length === 0) ? (
                        <p className="p-4 text-gray-400 text-center">No unassigned work in the pool.</p>
                    ) : (
                        <ul className="divide-y divide-gray-800">
                            {unassignedWork.map(demand => (
                                <li key={demand.id} className="p-4 sm:px-6 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <p className="text-lg font-medium text-white">
                                                    {demand.customer_firstname} {demand.customer_lastname}
                                                </p>
                                                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-900/50 text-gray-300 border border-gray-800">
                                                    UNASSIGNED
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400">
                                                {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                                            </p>
                                            <p className="text-sm text-gray-400">
                                                Camera: {demand.camera_model}
                                            </p>
                                            <p className="text-sm text-gray-400">
                                                Appointment: <span className="font-semibold text-white">{formatAppointment(demand.appointment_date, getDealerTimezone(demand))}</span>
                                            </p>
                                            {demand.address && (
                                                <p className="text-sm text-gray-500 mt-1">
                                                    Address: {demand.address}
                                                </p>
                                            )}
                                            <p className="text-sm text-gray-500 mt-1">
                                                Customer: {demand.customer_phone}
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1">
                                                Created: {format(new Date(demand.created_at), 'PPP p')}
                                            </p>
                                        </div>
                                        <WorkActions demandId={demand.id} isAssigned={false} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Other Assigned Work (for reference) */}
            {allAssignedWork && allAssignedWork.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold text-white mb-4">
                        Assigned to Others ({allAssignedWork.filter(w => w.assigned_specialist_id !== user.id).length})
                    </h2>
                    <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
                        <ul className="divide-y divide-gray-800">
                            {allAssignedWork
                                .filter(w => w.assigned_specialist_id !== user.id)
                                .map(demand => (
                                <li key={demand.id} className="p-4 sm:px-6 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <p className="text-lg font-medium text-gray-500">
                                                    {demand.customer_firstname} {demand.customer_lastname}
                                                </p>
                                                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-800">
                                                    ASSIGNED TO: {demand.profiles?.full_name ?? 'Unknown'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Camera: {demand.camera_model}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Appointment: {formatAppointment(demand.appointment_date, getDealerTimezone(demand))}
                                            </p>
                                            {demand.address && (
                                                <p className="text-sm text-gray-600 mt-1">
                                                    Address: {demand.address}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    )
}

