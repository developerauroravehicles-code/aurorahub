import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone } from '@/lib/timezone-defaults'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { checkCurrentUserPermission } from '@/lib/permissions'
import { assertDealerDemandAccess, canEditDemandCoreFields, canUseSmsFeatures, getInventoryManagerDealerId, isInventoryManager } from '@/lib/inventory-manager-access'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { DeleteDemandButton } from '../delete-demand-button'
import { ChangeSpecialistForm } from '../change-specialist-form'
import { ChangeFinanceForm } from '../change-finance-form'
import { EditCustomerForm } from '../edit-customer-form'
import { EditVinForm } from '../edit-vin-form'
import { EditStockNumberForm } from '../edit-stock-number-form'
import { EditCameraModelForm } from '../edit-camera-model-form'
import { EditCompletedAtForm } from '../edit-completed-at-form'
import { getCameraModelsForDealer } from '../get-cameras-for-dealer'
import { RescheduleDemandButton } from '../reschedule-demand-button'
import { DemandManualSmsPanel } from '../demand-manual-sms-panel'
import type { SMSTriggerType } from '@/lib/sms-settings'
import { DemandInstallationNotesSection, type InstallationNoteRow } from '../demand-installation-notes-section'
import { SERVICE_TYPE_LABELS, DemandServiceType } from '@/lib/demand-pricing'

/** List filters (date, status, dealer) are passed on the detail URL so "Back" can restore them. */
function demandsListHrefFromDetailSearch(
  sp: Record<string, string | string[] | undefined>
): string {
  const p = new URLSearchParams()
  for (const key of ['date', 'status', 'dealer'] as const) {
    const raw = sp[key]
    const v = Array.isArray(raw) ? raw[0] : raw
    if (typeof v === 'string' && v.length > 0) p.set(key, v)
  }
  const qs = p.toString()
  return qs ? `/dashboard/admin/demands?${qs}` : '/dashboard/admin/demands'
}

export default async function DemandDetailsPage({
  params,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, searchParams] = await Promise.all([params, searchParamsPromise])
  const backToDemandsHref = demandsListHrefFromDetailSearch(searchParams)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('profiles').select('role, dealer_id').eq('id', user.id).single()
    : { data: null }

  if (isInventoryManager(profile?.role) && !getInventoryManagerDealerId(profile)) {
    redirect('/dashboard')
  }
  
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
        <div className="text-zinc-900 dark:text-white">Demand not found</div>
        <Link href={backToDemandsHref} className="text-[#C27E00] hover:text-[#a06900]">
          ← Back to Demands
        </Link>
      </div>
    )
  }

  const dealerAccess = assertDealerDemandAccess(profile, demand.dealer_id)
  if (!dealerAccess.ok) {
    return (
      <div className="space-y-8">
        <div className="text-zinc-900 dark:text-white">Demand not found</div>
        <Link href={backToDemandsHref} className="text-[#C27E00] hover:text-[#a06900]">
          ← Back to Demands
        </Link>
      </div>
    )
  }

  const displayTzForDemand = getEffectiveTimezone(
    getTimezoneFromDealer(demand.dealers as Parameters<typeof getTimezoneFromDealer>[0])
  )

  const cameraModels = await getCameraModelsForDealer(demand.dealer_id ?? '')

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
  let canEditCoreFields = false
  let canSendManualSms = false
  let initialSentSmsTypes: SMSTriggerType[] = []
  let installationNotes: InstallationNoteRow[] = []
  if (user && profile) {
    isAuroraManager = profile.role === 'aurora_manager'
    canEditCoreFields = canEditDemandCoreFields(profile.role)
    canSendManualSms =
      canUseSmsFeatures(profile.role) &&
      (await checkCurrentUserPermission('comm.sms.send'))

    if (canSendManualSms) {
      // Use admin client (already initialised above) to bypass sms_logs RLS
      const { data: smsLogRows } = await admin
        .from('sms_logs')
        .select('message_type')
        .eq('demand_id', id)
        .eq('recipient_type', 'customer')
      initialSentSmsTypes = [
        ...new Set(
          (smsLogRows ?? []).map((r: { message_type: string }) => r.message_type as SMSTriggerType)
        ),
      ]
    }

    if (isAuroraManager) {
      const { data: notesRows } = await supabase
        .from('demand_installation_notes')
        .select('id, body, created_at, author_id, profiles!demand_installation_notes_author_id_fkey(full_name)')
        .eq('demand_id', id)
        .order('created_at', { ascending: false })

      installationNotes =
        notesRows?.map((row: any) => {
          const raw = row.profiles
          const profiles =
            raw == null
              ? null
              : Array.isArray(raw)
                ? (raw[0] as { full_name?: string | null }) ?? null
                : (raw as { full_name?: string | null })
          return {
            id: row.id as string,
            body: row.body as string,
            created_at: row.created_at as string,
            author_id: row.author_id as string | undefined,
            profiles: profiles ? { full_name: profiles.full_name ?? null } : null,
          }
        }) ?? []
    }
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
    getEffectiveTimezone(getTimezoneFromDealer(demand.dealers as Parameters<typeof getTimezoneFromDealer>[0])),
    'PPP h:mm a'
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link 
            href={backToDemandsHref}
            className="text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Demand Details</h1>
            <p className="text-zinc-500 dark:text-gray-400">View complete information and process history</p>
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
        <span className={`px-4 py-2 rounded-lg text-sm font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-zinc-200/80 dark:bg-gray-900/50 text-zinc-600 dark:text-gray-300 border-zinc-200 dark:border-gray-800'}`}>
          {demand.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demand ID (read-only) */}
        <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Demand ID</h2>
          <div>
            <p className="text-sm text-zinc-500 dark:text-gray-400">Reference Number</p>
            <p className="text-2xl font-bold text-[#C27E00]">#{demand.demand_number ?? '—'}</p>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Customer Information</h2>
          <EditCustomerForm
            demandId={id}
            firstName={demand.customer_firstname ?? ''}
            lastName={demand.customer_lastname ?? ''}
            phone={demand.customer_phone ?? ''}
            address={demand.customer_address}
            canEdit={canEditCoreFields}
          />
        </div>

        {/* Vehicle Information */}
        <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Vehicle Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-zinc-500 dark:text-gray-400">Vehicle</p>
              <p className="text-zinc-900 dark:text-white font-medium">{demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-gray-400 mb-1">Camera Model</p>
              <EditCameraModelForm
                demandId={id}
                cameraModel={demand.camera_model}
                cameraModels={cameraModels}
                canEdit={canEditCoreFields}
              />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-gray-400 mb-1">Stock Number</p>
              <EditStockNumberForm
                demandId={id}
                stockNumber={demand.stock_number}
                canEdit={canEditCoreFields}
              />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-gray-400 mb-1">VIN Last 6 Digits</p>
              <EditVinForm
                demandId={id}
                vinLast6={demand.vin_last6}
                canEdit={canEditCoreFields}
              />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-gray-400">Appointment Date</p>
              <p className="text-zinc-900 dark:text-white font-semibold text-[#C27E00]">
                {formatInTimeZone(new Date(demand.appointment_date), displayTzForDemand, 'PPP h:mm a')}
              </p>
            </div>
          </div>
        </div>

        {canSendManualSms && (
          <DemandManualSmsPanel
            demandId={id}
            assignedSpecialistId={demand.assigned_specialist_id}
            customerPhone={demand.customer_phone}
            initialSentTypes={initialSentSmsTypes}
          />
        )}

        {/* Creator Comment (if any) */}
        {demand.comment && (
          <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg lg:col-span-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Comment (from creator)</h2>
            <p className="text-zinc-600 dark:text-gray-300 whitespace-pre-wrap">{demand.comment}</p>
          </div>
        )}

        {/* Assignment Information */}
        <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Assignment Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-zinc-500 dark:text-gray-400">Dealer</p>
              <p className="text-zinc-900 dark:text-white">{(demand.dealers as any)?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-gray-400">Created By</p>
              <p className="text-zinc-900 dark:text-white">
                {(demand.profiles as any)?.full_name || 'Unknown'} 
                <span className="text-zinc-500 dark:text-gray-500 ml-2">({(demand.profiles as any)?.role || 'N/A'})</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-gray-400 mb-1">Assigned Finance</p>
              {isAuroraManager && financeUsers && financeUsers.length > 0 ? (
                <ChangeFinanceForm
                  demandId={id}
                  currentFinanceId={demand.assigned_finance_id}
                  financeUsers={financeUsers}
                />
              ) : demand.assigned_finance_id ? (
                <p className="text-zinc-900 dark:text-white">
                  {(demand.assigned_finance as any)?.full_name || 'Unknown'}
                  <span className="text-zinc-500 dark:text-gray-500 ml-2">({(demand.assigned_finance as any)?.role || 'N/A'})</span>
                </p>
              ) : (
                <p className="text-zinc-500 dark:text-gray-500 text-sm">Unassigned</p>
              )}
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-gray-400 mb-1">Assigned Specialist</p>
              {isAuroraManager && specialists && specialists.length > 0 ? (
                <ChangeSpecialistForm
                  demandId={id}
                  currentSpecialistId={demand.assigned_specialist_id}
                  currentSpecialistName={(demand.assigned_specialist as any)?.full_name}
                  specialists={specialists}
                />
              ) : demand.assigned_specialist_id ? (
                <p className="text-zinc-900 dark:text-white">
                  {(demand.assigned_specialist as any)?.full_name || 'Unknown'}
                  <span className="text-zinc-500 dark:text-gray-500 ml-2">({(demand.assigned_specialist as any)?.role || 'N/A'})</span>
                </p>
              ) : (
                <p className="text-zinc-500 dark:text-gray-500 text-sm">Unassigned</p>
              )}
            </div>
          </div>
        </div>

        {/* Timeline Information */}
        <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Timeline</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-zinc-500 dark:text-gray-400">Created At</p>
              <p className="text-zinc-900 dark:text-white">{formatInTimeZone(new Date(demand.created_at), getEffectiveTimezone((demand.dealers as { region_codes?: { timezones?: { name: string } } } | null)?.region_codes?.timezones?.name ?? null), 'PPP h:mm a')}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-gray-400">Last Updated</p>
              <p className="text-zinc-900 dark:text-white">{formatInTimeZone(new Date(demand.updated_at || demand.created_at), getEffectiveTimezone((demand.dealers as { region_codes?: { timezones?: { name: string } } } | null)?.region_codes?.timezones?.name ?? null), 'PPP h:mm a')}</p>
            </div>
            {demand.status === 'completed' && (
              <div>
                <p className="text-sm text-zinc-500 dark:text-gray-400 mb-1">
                  Completed At (Pacific — statements / invoices)
                </p>
                <EditCompletedAtForm
                  demandId={id}
                  completedAt={(demand as { completed_at?: string | null }).completed_at ?? null}
                  appointmentDate={demand.appointment_date}
                  canEdit={isAuroraManager}
                />
              </div>
            )}
            {demand.status === 'completed' && (demand as { service_type?: DemandServiceType | null }).service_type && (
              <div>
                <p className="text-sm text-zinc-500 dark:text-gray-400">Service type</p>
                <p className="text-zinc-900 dark:text-white">
                  {SERVICE_TYPE_LABELS[(demand as { service_type: DemandServiceType }).service_type]}
                </p>
              </div>
            )}
            {demand.status === 'completed' &&
              (demand as { invoice_total_amount?: number | null }).invoice_total_amount != null && (
                <div>
                  <p className="text-sm text-zinc-500 dark:text-gray-400">Invoice total (CAD)</p>
                  <p className="text-zinc-900 dark:text-white tabular-nums">
                    ${Number((demand as { invoice_total_amount: number }).invoice_total_amount).toFixed(2)}
                  </p>
                </div>
              )}
          </div>
        </div>

        {isAuroraManager && (
          <DemandInstallationNotesSection
            demandId={id}
            initialNotes={installationNotes}
            timezoneName={displayTzForDemand}
          />
        )}
      </div>

      {/* Process History / Demand Logs */}
      {logs && logs.length > 0 && (
        <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Process History</h2>
          <div className="space-y-4">
            {logs.map((log: any) => (
              <div key={log.id} className="border-l-2 border-zinc-300 dark:border-gray-700 pl-4 py-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-zinc-900 dark:text-white font-medium">
                      {(log.profiles as any)?.full_name || 'System'} 
                      <span className="text-zinc-500 dark:text-gray-500 ml-2">({(log.profiles as any)?.role || 'N/A'})</span>
                    </p>
                    {log.previous_status !== log.new_status && log.new_status && (
                      <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">
                        {log.previous_status ? (
                          <>Changed status from <span className="text-zinc-600 dark:text-gray-300">{String(log.previous_status).replace('_', ' ')}</span> to{' '}
                          <span className="text-zinc-600 dark:text-gray-300">{String(log.new_status).replace('_', ' ')}</span></>
                        ) : (
                          <>Status: <span className="text-zinc-600 dark:text-gray-300">{String(log.new_status).replace('_', ' ')}</span></>
                        )}
                      </p>
                    )}
                    {log.notes && (
                      <p className="text-sm text-zinc-500 dark:text-gray-500 mt-1 italic">{log.notes}</p>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-gray-500">
                    {formatInTimeZone(new Date(log.created_at), getEffectiveTimezone((demand.dealers as { region_codes?: { timezones?: { name: string } } } | null)?.region_codes?.timezones?.name ?? null), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!logs || logs.length === 0) && (
        <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Process History</h2>
          <p className="text-zinc-500 dark:text-gray-400">No process history available yet.</p>
        </div>
      )}
    </div>
  )
}

