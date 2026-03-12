import { createClient } from '@/lib/supabase/server'
import { getDuplicateStockNumbers } from '@/lib/demand-stock'
import { WorkActions } from './work-actions'
import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone } from '@/lib/timezone-defaults'

type WorkDemandRow = {
  id: string
  demand_number?: number | string
  customer_firstname: string
  customer_lastname: string
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  camera_model: string
  appointment_date: string
  customer_phone: string
  customer_address?: string | null
  created_at: string
  stock_number?: string | null
  vin_last6?: string | null
  comment?: string | null
  assigned_specialist_id?: string | null
  dealers?: { name?: string; region_codes?: { timezones?: { name: string } } } | null
  profiles?: { full_name: string } | null
}

function DemandContentCard({
  demand,
  statusBadge,
  accentColor,
  formatAppointment,
  getDealerTimezone,
  actions,
  duplicateStockNumbers = [],
}: {
  demand: WorkDemandRow
  statusBadge: React.ReactNode
  accentColor: 'default' | 'assigned'
  formatAppointment: (date: string, tz: string | null) => string
  getDealerTimezone: (d: WorkDemandRow) => string | null
  actions?: React.ReactNode
  duplicateStockNumbers?: string[]
}) {
  const dealerName = (demand.dealers as { name?: string } | null)?.name ?? '—'
  const tz = getDealerTimezone(demand)

  return (
    <div className="p-5 sm:px-6 rounded-lg border border-gray-800/80 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-lg font-semibold ${accentColor === 'assigned' ? 'text-[#C27E00]' : 'text-white'}`}>
              {demand.customer_firstname} {demand.customer_lastname}
            </p>
            {demand.demand_number != null && (
              <span className="text-xs font-medium text-gray-500">#{demand.demand_number}</span>
            )}
            {demand.stock_number && duplicateStockNumbers.includes((demand.stock_number || '').trim().toUpperCase()) && (
              <span className="text-xs text-amber-400">(Duplicate Stock No)</span>
            )}
            {statusBadge}
            {dealerName !== '—' && (
              <span className="text-xs text-gray-500">· {dealerName}</span>
            )}
          </div>

          {/* Customer & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Customer</p>
              <p className="text-gray-300">{demand.customer_phone || '—'}</p>
            </div>
          </div>

          {/* Vehicle */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Vehicle</p>
            <p className="text-gray-300">
              {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
              {demand.stock_number && (
                <span className="ml-2 text-gray-500">Stock: {demand.stock_number}</span>
              )}
              {demand.vin_last6 && (
                <span className="ml-2 text-gray-500">VIN: …{demand.vin_last6}</span>
              )}
            </p>
          </div>

          {/* Installation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Camera Model</p>
              <p className="text-gray-300">{demand.camera_model || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Appointment</p>
              <p className="font-medium text-white">{formatAppointment(demand.appointment_date, tz)}</p>
            </div>
          </div>

          {/* Location */}
          {(demand.customer_address || demand.comment) && (
            <div className="space-y-2">
              {demand.customer_address && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Address</p>
                  <p className="text-gray-300">{demand.customer_address}</p>
                </div>
              )}
              {demand.comment && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Notes</p>
                  <p className="text-gray-400 italic whitespace-pre-wrap">{demand.comment}</p>
                </div>
              )}
            </div>
          )}

          {/* Meta */}
          <p className="text-xs text-gray-600">
            Created: {formatInTimeZone(new Date(demand.created_at), getEffectiveTimezone(tz ?? null), 'PPP h:mm a')}
          </p>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  )
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
            .select('*, profiles!demands_assigned_specialist_id_fkey(full_name), dealers(name, region_codes(timezone_id, timezones(name)))')
            .in('dealer_id', dealerIds)
            .eq('status', 'approved')
            .is('assigned_specialist_id', null)
            .order('appointment_date', { ascending: true })
        unassignedWork = (data ?? []) as WorkDemandRow[]
    }

    // Get assigned work for current user
    const { data: myAssignedWork } = await supabase
        .from('demands')
        .select('*, profiles!demands_assigned_specialist_id_fkey(full_name), dealers(name, region_codes(timezone_id, timezones(name)))')
        .eq('assigned_specialist_id', user.id)
        .eq('status', 'approved')
        .order('appointment_date', { ascending: true })

    // Get all assigned work (for reference) — only from dealers this specialist can serve
    let allAssignedWork: WorkDemandRow[] = []
    if (dealerIds.length > 0) {
        const { data } = await supabase
            .from('demands')
            .select('*, profiles!demands_assigned_specialist_id_fkey(full_name), dealers(name, region_codes(timezone_id, timezones(name)))')
            .in('dealer_id', dealerIds)
            .eq('status', 'approved')
            .not('assigned_specialist_id', 'is', null)
            .order('appointment_date', { ascending: true })
        allAssignedWork = (data ?? []) as WorkDemandRow[]
    }

    const duplicateStockNumbers = Array.from(await getDuplicateStockNumbers())

    const getDealerTimezone = (d: { dealers?: { region_codes?: { timezones?: { name: string } } } | null }) =>
      (d.dealers as { region_codes?: { timezones?: { name: string } } } | null)?.region_codes?.timezones?.name ?? null
    const formatAppointment = (appointmentDate: string, timezoneName: string | null) =>
      formatInTimeZone(new Date(appointmentDate), getEffectiveTimezone(timezoneName ?? null), 'PPP h:mm a')

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
                    <div className="space-y-4">
                        {myAssignedWork.map(demand => (
                            <DemandContentCard
                                key={demand.id}
                                demand={demand}
                                statusBadge={
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-800">
                                        ASSIGNED TO ME
                                    </span>
                                }
                                accentColor="assigned"
                                formatAppointment={formatAppointment}
                                getDealerTimezone={getDealerTimezone}
                                actions={<WorkActions demandId={demand.id} isAssigned={true} vinLast6={demand.vin_last6} />}
                                duplicateStockNumbers={duplicateStockNumbers}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Work Pool - Unassigned Work */}
            <div>
                <h2 className="text-xl font-semibold text-white mb-4">
                    Work Pool - Unassigned ({unassignedWork?.length || 0})
                </h2>
                <div>
                    {(!unassignedWork || unassignedWork.length === 0) ? (
                        <p className="p-4 text-gray-400 text-center rounded-lg border border-gray-800 bg-white/5">No unassigned work in the pool.</p>
                    ) : (
                        <div className="space-y-4">
                            {unassignedWork.map(demand => (
                                <DemandContentCard
                                    key={demand.id}
                                    demand={demand}
                                    statusBadge={
                                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-900/50 text-gray-300 border border-gray-800">
                                            UNASSIGNED
                                        </span>
                                    }
                                    accentColor="default"
                                    formatAppointment={formatAppointment}
                                    getDealerTimezone={getDealerTimezone}
                                    actions={<WorkActions demandId={demand.id} isAssigned={false} />}
                                    duplicateStockNumbers={duplicateStockNumbers}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Other Assigned Work (for reference) */}
            {allAssignedWork && allAssignedWork.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold text-white mb-4">
                        Assigned to Others ({allAssignedWork.filter(w => w.assigned_specialist_id !== user.id).length})
                    </h2>
                    <div className="space-y-4">
                        {allAssignedWork
                            .filter(w => w.assigned_specialist_id !== user.id)
                            .map(demand => (
                            <DemandContentCard
                                key={demand.id}
                                demand={demand}
                                statusBadge={
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-800">
                                        ASSIGNED TO: {demand.profiles?.full_name ?? 'Unknown'}
                                    </span>
                                }
                                accentColor="default"
                                formatAppointment={formatAppointment}
                                getDealerTimezone={getDealerTimezone}
                                duplicateStockNumbers={duplicateStockNumbers}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

