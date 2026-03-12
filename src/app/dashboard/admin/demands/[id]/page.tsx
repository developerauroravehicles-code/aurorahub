import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone } from '@/lib/timezone-defaults'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DeleteDemandButton } from '../delete-demand-button'
import { ChangeSpecialistForm } from '../change-specialist-form'
import { ChangeFinanceForm } from '../change-finance-form'
import { EditCustomerForm } from '../edit-customer-form'
import { EditVinForm } from '../edit-vin-form'
import { EditStockNumberForm } from '../edit-stock-number-form'
import { RescheduleDemandButton } from '../reschedule-demand-button'

export default async function DemandDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch demand with all related data (dealers timezone for appointment display)
  const { data: demand } = await supabase
    .from('demands')
    .select(`
      *,
      dealers(name, region_codes(timezone_id, timezones(name))),
      profiles!demands_created_by_fkey(full_name, role),
      assigned_finance:profiles!demands_assigned_finance_id_fkey(full_name, role),
      assigned_specialist:profiles!demands_assigned_specialist_id_fkey(full_name, role)
    `)
    .eq('id', id)
    .single()

  if (!demand) {
    return (
      <div className="space-y-8">
        <div className="text-white">Demand not found</div>
        <Link href="/dashboard/admin/demands" className="text-[#C27E00] hover:text-[#a06900]">
          ← Back to Demands
        </Link>
      </div>
    )
  }

  // Fetch demand logs (admin client - user already verified access via demand fetch)
  const admin = createAdminClient()
  const { data: logsRows } = await admin
    .from('demand_logs')
    .select('id, demand_id, actor_id, previous_status, new_status, notes, created_at')
    .eq('demand_id', id)
    .order('created_at', { ascending: false })
  const actorIds = [...new Set((logsRows ?? []).map((l: { actor_id?: string }) => l.actor_id).filter(Boolean))]
  let actorProfiles: Record<string, { full_name?: string; role?: string }> = {}
  if (actorIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, full_name, role').in('id', actorIds)
    actorProfiles = (profiles ?? []).reduce((acc, p) => {
      acc[p.id] = { full_name: p.full_name, role: p.role }
      return acc
    }, {} as Record<string, { full_name?: string; role?: string }>)
  }
  const logs = (logsRows ?? []).map((l: Record<string, unknown>) => ({
    ...l,
    profiles: l.actor_id ? actorProfiles[l.actor_id as string] : null,
  }))

  const statusColors = {
    pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
    approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
    completed: 'bg-green-900/50 text-green-300 border-green-800',
    cancelled: 'bg-red-900/50 text-red-300 border-red-800'
  }

  let isAuroraManager = false
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isAuroraManager = profile?.role === 'aurora_manager'
  }

  // Fetch specialists and finance users for Aurora Manager (change assignment)
  const { data: specialists } = isAuroraManager
    ? await supabase.from('profiles').select('id, full_name').eq('role', 'specialist').order('full_name')
    : { data: [] }
  const { data: financeUsers } = isAuroraManager
    ? await supabase.from('profiles').select('id, full_name').eq('role', 'finance').order('full_name')
    : { data: [] }

  const customerName = `${demand.customer_firstname} ${demand.customer_lastname}`
  const formattedAppointment = formatInTimeZone(
    new Date(demand.appointment_date),
    getEffectiveTimezone((demand.dealers as { region_codes?: { timezones?: { name: string } } } | null)?.region_codes?.timezones?.name ?? null),
    'PPP h:mm a'
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/admin/demands"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-white">Demand Details</h1>
            <p className="text-gray-400">View complete information and process history</p>
          </div>
        </div>
        {isAuroraManager && (
          <div className="flex gap-2">
            <RescheduleDemandButton demand={demand} />
            <DeleteDemandButton
              demandId={id}
              customerName={customerName}
              appointmentDate={formattedAppointment}
            />
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <span className={`px-4 py-2 rounded-lg text-sm font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-gray-900/50 text-gray-300 border-gray-800'}`}>
          {demand.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demand ID (read-only) */}
        <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Demand ID</h2>
          <div>
            <p className="text-sm text-gray-400">Reference Number</p>
            <p className="text-2xl font-bold text-[#C27E00]">#{demand.demand_number ?? '—'}</p>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Customer Information</h2>
          <EditCustomerForm
            demandId={id}
            firstName={demand.customer_firstname ?? ''}
            lastName={demand.customer_lastname ?? ''}
            phone={demand.customer_phone ?? ''}
            address={demand.customer_address}
            isAuroraManager={isAuroraManager}
          />
        </div>

        {/* Vehicle Information */}
        <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Vehicle Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-400">Vehicle</p>
              <p className="text-white font-medium">{demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Camera Model</p>
              <p className="text-white">{demand.camera_model}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Stock Number</p>
              <EditStockNumberForm
                demandId={id}
                stockNumber={demand.stock_number}
                isAuroraManager={isAuroraManager}
              />
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">VIN Last 6 Digits</p>
              <EditVinForm
                demandId={id}
                vinLast6={demand.vin_last6}
                isAuroraManager={isAuroraManager}
              />
            </div>
            <div>
              <p className="text-sm text-gray-400">Appointment Date</p>
              <p className="text-white font-semibold text-[#C27E00]">
                {formatInTimeZone(new Date(demand.appointment_date), getEffectiveTimezone((demand.dealers as { region_codes?: { timezones?: { name: string } } } | null)?.region_codes?.timezones?.name ?? null), 'PPP h:mm a')}
              </p>
            </div>
          </div>
        </div>

        {/* Creator Comment (if any) */}
        {demand.comment && (
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg lg:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-4">Comment (from creator)</h2>
            <p className="text-gray-300 whitespace-pre-wrap">{demand.comment}</p>
          </div>
        )}

        {/* Assignment Information */}
        <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Assignment Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-400">Dealer</p>
              <p className="text-white">{(demand.dealers as any)?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Created By</p>
              <p className="text-white">
                {(demand.profiles as any)?.full_name || 'Unknown'} 
                <span className="text-gray-500 ml-2">({(demand.profiles as any)?.role || 'N/A'})</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Assigned Finance</p>
              {isAuroraManager && financeUsers && financeUsers.length > 0 ? (
                <ChangeFinanceForm
                  demandId={id}
                  currentFinanceId={demand.assigned_finance_id}
                  financeUsers={financeUsers}
                />
              ) : demand.assigned_finance_id ? (
                <p className="text-white">
                  {(demand.assigned_finance as any)?.full_name || 'Unknown'}
                  <span className="text-gray-500 ml-2">({(demand.assigned_finance as any)?.role || 'N/A'})</span>
                </p>
              ) : (
                <p className="text-gray-500 text-sm">Unassigned</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Assigned Specialist</p>
              {isAuroraManager && specialists && specialists.length > 0 ? (
                <ChangeSpecialistForm
                  demandId={id}
                  currentSpecialistId={demand.assigned_specialist_id}
                  currentSpecialistName={(demand.assigned_specialist as any)?.full_name}
                  specialists={specialists}
                />
              ) : demand.assigned_specialist_id ? (
                <p className="text-white">
                  {(demand.assigned_specialist as any)?.full_name || 'Unknown'}
                  <span className="text-gray-500 ml-2">({(demand.assigned_specialist as any)?.role || 'N/A'})</span>
                </p>
              ) : (
                <p className="text-gray-500 text-sm">Unassigned</p>
              )}
            </div>
          </div>
        </div>

        {/* Timeline Information */}
        <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Timeline</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-400">Created At</p>
              <p className="text-white">{formatInTimeZone(new Date(demand.created_at), getEffectiveTimezone((demand.dealers as { region_codes?: { timezones?: { name: string } } } | null)?.region_codes?.timezones?.name ?? null), 'PPP h:mm a')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Last Updated</p>
              <p className="text-white">{formatInTimeZone(new Date(demand.updated_at || demand.created_at), getEffectiveTimezone((demand.dealers as { region_codes?: { timezones?: { name: string } } } | null)?.region_codes?.timezones?.name ?? null), 'PPP h:mm a')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Process History / Demand Logs */}
      {logs && logs.length > 0 && (
        <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Process History</h2>
          <div className="space-y-4">
            {logs.map((log: any) => (
              <div key={log.id} className="border-l-2 border-gray-700 pl-4 py-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-white font-medium">
                      {(log.profiles as any)?.full_name || 'System'} 
                      <span className="text-gray-500 ml-2">({(log.profiles as any)?.role || 'N/A'})</span>
                    </p>
                    {log.previous_status !== log.new_status && log.new_status && (
                      <p className="text-sm text-gray-400 mt-1">
                        {log.previous_status ? (
                          <>Changed status from <span className="text-gray-300">{String(log.previous_status).replace('_', ' ')}</span> to{' '}
                          <span className="text-gray-300">{String(log.new_status).replace('_', ' ')}</span></>
                        ) : (
                          <>Status: <span className="text-gray-300">{String(log.new_status).replace('_', ' ')}</span></>
                        )}
                      </p>
                    )}
                    {log.notes && (
                      <p className="text-sm text-gray-500 mt-1 italic">{log.notes}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatInTimeZone(new Date(log.created_at), getEffectiveTimezone((demand.dealers as { region_codes?: { timezones?: { name: string } } } | null)?.region_codes?.timezones?.name ?? null), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!logs || logs.length === 0) && (
        <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Process History</h2>
          <p className="text-gray-400">No process history available yet.</p>
        </div>
      )}
    </div>
  )
}

