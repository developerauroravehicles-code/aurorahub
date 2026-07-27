import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { ArrowLeft } from 'lucide-react'
import { DealerAssignment } from './dealer-assignment'
import { getSpecialistCompensationSnapshot } from '../compensation-actions'
import { SpecialistCompensationPanel } from '../specialist-compensation-panel'

export default async function SpecialistDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const canManage = ['aurora_manager', 'hr'].includes(currentProfile?.role ?? '')
  const isAuroraManager = currentProfile?.role === 'aurora_manager'

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, dealers(name)')
    .eq('id', id)
    .single()

  if (!profile || profile.role !== 'specialist') {
    return <div className="text-zinc-900 dark:text-white">Technical Support not found</div>
  }

  if (!canManage) redirect('/dashboard/admin/employees')

  const { data: assignedDealersRaw } = isAuroraManager
    ? await supabase
        .from('specialist_dealers')
        .select('id, dealer_id, dealers(name)')
        .eq('specialist_id', id)
        .order('created_at', { ascending: true })
    : { data: null }

  const assignedDealers =
    assignedDealersRaw?.map((ad) => ({
      id: ad.id,
      dealer_id: ad.dealer_id,
      dealers: { name: (ad.dealers as { name?: string } | null)?.name || '' },
    })) ?? []

  const { data: allDealers } = isAuroraManager
    ? await supabase.from('dealers').select('id, name').order('name')
    : { data: null }

  const { data: completedJobs } = await supabase
    .from('demands')
    .select(
      'id, demand_number, status, updated_at, completed_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, appointment_date, dealers(name, region_codes(timezones(name)))'
    )
    .eq('status', 'completed')
    .eq('assigned_specialist_id', id)
    .order('completed_at', { ascending: false })
    .limit(50)

  const { data: pendingJobs } = await supabase
    .from('demands')
    .select(
      'id, demand_number, status, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, appointment_date, dealers(name, region_codes(timezones(name)))'
    )
    .eq('status', 'approved')
    .eq('assigned_specialist_id', id)
    .order('appointment_date', { ascending: true })
    .limit(50)

  const { data: serviceJobs } = await supabase
    .from('customer_service_records')
    .select('id, demand_number, status, diagnosis_code, completed_at, service_appointment_at, vehicle_summary')
    .eq('assigned_specialist_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  const compensationResult = await getSpecialistCompensationSnapshot(id)
  const compensationSnapshot = compensationResult.snapshot

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/admin/employees"
          className="flex items-center text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Employees
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">{profile.full_name}</h1>
        <p className="text-zinc-500 dark:text-gray-400">
          Technical Support
          {assignedDealers.length > 0 ? (
            <span className="text-[#C27E00]">
              {' '}
              · {assignedDealers.map((ad) => ad.dealers.name).join(', ')}
            </span>
          ) : null}
        </p>
      </div>

      {isAuroraManager ? (
        <DealerAssignment
          specialistId={id}
          assignedDealers={assignedDealers}
          availableDealers={allDealers ?? []}
        />
      ) : null}

      {compensationSnapshot ? (
        <SpecialistCompensationPanel profileId={id} initialSnapshot={compensationSnapshot} />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-5 rounded-lg">
          <h3 className="text-sm font-medium text-zinc-600 dark:text-gray-300">Installations (this period)</h3>
          <p className="text-3xl font-bold text-[#C27E00] mt-1">
            {compensationSnapshot?.installations_completed ?? 0}
          </p>
        </div>
        <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-5 rounded-lg">
          <h3 className="text-sm font-medium text-zinc-600 dark:text-gray-300">Service jobs completed</h3>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white mt-1">
            {compensationSnapshot?.service_jobs_completed ?? 0}
          </p>
        </div>
        <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-5 rounded-lg">
          <h3 className="text-sm font-medium text-zinc-600 dark:text-gray-300">Assigned / in progress</h3>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white mt-1">{pendingJobs?.length ?? 0}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">Assigned installations</h2>
          <JobList
            jobs={(pendingJobs ?? []) as JobRow[]}
            empty="No installations currently assigned."
            showDealer={isAuroraManager}
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">Recent installations</h2>
          <JobList
            jobs={(completedJobs ?? []) as JobRow[]}
            empty="No completed installations yet."
            completed
            showDealer={isAuroraManager}
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">Service records</h2>
          <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg overflow-hidden">
            {!serviceJobs?.length ? (
              <p className="p-4 text-zinc-500">No service records assigned.</p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
                {serviceJobs.map((job) => (
                  <li key={job.id} className="p-4 text-sm">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          #{job.demand_number} · {job.vehicle_summary}
                        </p>
                        <p className="text-zinc-500 capitalize">{job.diagnosis_code?.replace(/_/g, ' ')}</p>
                      </div>
                      <span className="text-xs uppercase font-semibold text-zinc-500">{job.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

type JobRow = {
  id: string
  demand_number?: number | string | null
  vehicle_year?: number | null
  vehicle_make?: string | null
  vehicle_model?: string | null
  customer_firstname?: string | null
  customer_lastname?: string | null
  appointment_date?: string | null
  updated_at?: string | null
  completed_at?: string | null
  dealers?: { name?: string; region_codes?: { timezones?: { name: string } } | null } | null
}

function JobList({
  jobs,
  empty,
  completed,
  showDealer,
}: {
  jobs: JobRow[]
  empty: string
  completed?: boolean
  showDealer?: boolean
}) {
  if (!jobs.length) {
    return (
      <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-4 text-zinc-500">
        {empty}
      </div>
    )
  }

  return (
    <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
        {jobs.map((job) => {
          const jobTz = job.dealers?.region_codes?.timezones?.name ?? null
          const dateSource = completed
            ? job.completed_at || job.updated_at
            : job.appointment_date
          return (
            <li key={job.id} className="p-4 hover:bg-zinc-200/30 dark:hover:bg-white/5">
              <div className="flex justify-between items-center gap-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">
                    {job.vehicle_year} {job.vehicle_make} {job.vehicle_model}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {job.customer_firstname} {job.customer_lastname}
                  </p>
                  {job.demand_number != null ? (
                    <p className="text-xs text-zinc-500 mt-0.5">#{job.demand_number}</p>
                  ) : null}
                  {showDealer && job.dealers?.name ? (
                    <p className="text-xs text-zinc-500">{job.dealers.name}</p>
                  ) : null}
                </div>
                <div className="text-right text-sm">
                  {completed ? (
                    <p className="text-green-600 dark:text-green-400">Completed</p>
                  ) : null}
                  {dateSource ? (
                    <p className="text-zinc-500 text-xs">
                      {jobTz
                        ? formatInTimeZone(new Date(dateSource), jobTz, 'PPP')
                        : format(new Date(dateSource), 'PPP')}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
