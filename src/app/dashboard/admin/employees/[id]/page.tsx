import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DealerAssignment } from './dealer-assignment'

export default async function SpecialistDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  
  // Check if current user is Aurora Manager
  const { data: { user } } = await supabase.auth.getUser()
  let isAuroraManager = false
  
  if (user) {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    isAuroraManager = currentProfile?.role === 'aurora_manager'
  }
  
  // Fetch Specialist Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, dealers(name)')
    .eq('id', id)
    .single()

  if (!profile) return <div className="text-white">Technical Support not found</div>

  // Fetch assigned dealers for this specialist (only if Aurora Manager)
  const { data: assignedDealersRaw } = isAuroraManager
    ? await supabase
        .from('specialist_dealers')
        .select('id, dealer_id, dealers(name)')
        .eq('specialist_id', id)
        .order('created_at', { ascending: true })
    : { data: null }
  
  // Transform data to match component's expected type
  const assignedDealers = assignedDealersRaw?.map((ad: any) => ({
    id: ad.id,
    dealer_id: ad.dealer_id,
    dealers: {
      name: (ad.dealers as any)?.name || ''
    }
  })) || null

  // Fetch all dealers for assignment dropdown (only if Aurora Manager)
  const { data: allDealers } = isAuroraManager
    ? await supabase
        .from('dealers')
        .select('id, name')
        .order('name')
    : { data: null }

  // Fetch Jobs (Demands) assigned to this specialist OR completed by them (if we track 'completed_by')
  // For now, let's assume jobs are linked via 'assigned_specialist_id' or implicit assignment via dealer pool logic.
  // The prompt says "completed" and "pending".
  // Pending jobs for a specialist are usually 'approved' status in their dealer pool (or specifically assigned).
  // Completed jobs are 'completed' status.
  
  // Let's fetch ALL demands for this specialist's dealer to calculate stats if they work from a pool,
  // OR fetch demands specifically assigned to them if we implemented assignment.
  // Based on current schema: `assigned_specialist_id` exists.
  // Also specialists pick from pool. 
  // Let's fetch demands where status is 'completed' AND (updated_by this user? we don't have that field easily accessible without logs).
  // OR we can rely on `assigned_specialist_id`.
  
  // Let's assume `assigned_specialist_id` is set when they pick it or complete it.
  
  // Get list of dealer IDs assigned to this specialist (only if Aurora Manager can see them)
  // For non-Aurora Managers, we still need to fetch jobs but won't show dealer names
  const assignedDealerIds = (isAuroraManager && assignedDealers) ? assignedDealers.map(ad => ad.dealer_id) : []
  
  // If specialist has assigned dealers, fetch jobs from all assigned dealers
  // Otherwise, fall back to profile.dealer_id (for backward compatibility)
  // For non-Aurora Managers, we'll use profile.dealer_id but won't show dealer names in UI
  const dealerIdsToQuery = assignedDealerIds.length > 0 ? assignedDealerIds : (profile.dealer_id ? [profile.dealer_id] : [])

  // Fetch Completed Jobs from all assigned dealers (with dealer timezone for date display)
  const { data: completedJobs } = assignedDealerIds.length > 0
    ? await supabase
        .from('demands')
        .select('id, demand_number, status, created_at, updated_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, appointment_date, dealer_id, dealers(name, region_codes(timezone_id, timezones(name)))')
        .eq('status', 'completed')
        .in('dealer_id', assignedDealerIds)
        .order('updated_at', { ascending: false })
    : await supabase
        .from('demands')
        .select('id, demand_number, status, created_at, updated_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, appointment_date, dealer_id, dealers(name, region_codes(timezone_id, timezones(name)))')
        .eq('status', 'completed')
        .eq('dealer_id', profile.dealer_id || '')
        .order('updated_at', { ascending: false })
    
  // Fetch Pending Jobs (Approved but not completed) from all assigned dealers (with dealer timezone)
  const { data: pendingJobs } = assignedDealerIds.length > 0
    ? await supabase
        .from('demands')
        .select('id, demand_number, status, created_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, appointment_date, dealer_id, dealers(name, region_codes(timezone_id, timezones(name)))')
        .eq('status', 'approved')
        .in('dealer_id', assignedDealerIds)
        .order('appointment_date', { ascending: true })
    : await supabase
        .from('demands')
        .select('id, demand_number, status, created_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, appointment_date, dealer_id, dealers(name, region_codes(timezone_id, timezones(name)))')
        .eq('status', 'approved')
        .eq('dealer_id', profile.dealer_id || '')
        .order('appointment_date', { ascending: true })

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/admin/employees" className="flex items-center text-gray-400 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Employees
        </Link>
        <h1 className="text-2xl font-bold text-white mb-2">{profile.full_name}</h1>
        <p className="text-gray-400">
          {profile.role.replace('_', ' ')}
          {isAuroraManager && assignedDealers && assignedDealers.length > 0 ? (
            <span className="text-[#C27E00]">
              {' '}at {assignedDealers.map(ad => (ad.dealers as any)?.name).join(', ')}
            </span>
          ) : isAuroraManager && profile.dealers?.name ? (
            <span className="text-[#C27E00]"> at {profile.dealers.name}</span>
          ) : null}
        </p>
      </div>

      {/* Dealer Assignment Section (only for Aurora Managers) */}
      {isAuroraManager && (
        <DealerAssignment
          specialistId={id}
          assignedDealers={assignedDealers || []}
          availableDealers={allDealers || []}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stats Cards */}
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-medium text-gray-300">Completed Jobs</h3>
              <p className="text-4xl font-bold text-[#C27E00] mt-2">{completedJobs?.length || 0}</p>
          </div>
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-medium text-gray-300">Pending Jobs (Dealer Pool)</h3>
              <p className="text-4xl font-bold text-white mt-2">{pendingJobs?.length || 0}</p>
          </div>
      </div>

      {/* Detailed Lists */}
      <div className="space-y-6">
          <div>
              <h2 className="text-xl font-semibold text-white mb-4">Pending Jobs</h2>
              <div className="bg-white/5 border border-gray-800 rounded-lg overflow-hidden">
                  {pendingJobs?.length === 0 ? (
                      <p className="p-4 text-gray-500">No pending jobs.</p>
                  ) : (
                      <ul className="divide-y divide-gray-800">
                          {pendingJobs?.map(job => {
                              const jobTz = (job.dealers as { region_codes?: { timezones?: { name: string } } } | null)?.region_codes?.timezones?.name ?? null
                              return (
                              <li key={job.id} className="p-4 hover:bg-white/5 transition-colors">
                                  <div className="flex justify-between items-center">
                                      <div>
                                          <p className="font-medium text-white">{job.vehicle_year} {job.vehicle_make} {job.vehicle_model}</p>
                                          <p className="text-sm text-gray-400">{job.customer_firstname} {job.customer_lastname}</p>
                                          {(job as { demand_number?: number }).demand_number != null && (
                                            <p className="text-xs text-gray-500 mt-1">Demand ID: #{(job as { demand_number?: number }).demand_number}</p>
                                          )}
                                          {isAuroraManager && (job.dealers as any)?.name && (
                                            <p className="text-xs text-gray-500 mt-1">Dealer: {(job.dealers as any).name}</p>
                                          )}
                                      </div>
                                      <div className="text-right">
                                          <p className="text-sm text-[#C27E00]">{jobTz ? formatInTimeZone(new Date(job.appointment_date), jobTz, 'PPP h:mm a') : format(new Date(job.appointment_date), 'PPP h:mm a')}</p>
                                      </div>
                                  </div>
                              </li>
                              )
                          })}
                      </ul>
                  )}
              </div>
          </div>

          <div>
              <h2 className="text-xl font-semibold text-white mb-4">Completed Jobs History</h2>
              <div className="bg-white/5 border border-gray-800 rounded-lg overflow-hidden">
                  {completedJobs?.length === 0 ? (
                      <p className="p-4 text-gray-500">No completed jobs.</p>
                  ) : (
                      <ul className="divide-y divide-gray-800">
                          {completedJobs?.map(job => {
                              const jobTz = (job.dealers as { region_codes?: { timezones?: { name: string } } } | null)?.region_codes?.timezones?.name ?? null
                              return (
                              <li key={job.id} className="p-4 hover:bg-white/5 transition-colors">
                                  <div className="flex justify-between items-center">
                                      <div>
                                          <p className="font-medium text-white">{job.vehicle_year} {job.vehicle_make} {job.vehicle_model}</p>
                                          <p className="text-sm text-gray-400">{job.customer_firstname} {job.customer_lastname}</p>
                                          {(job as { demand_number?: number }).demand_number != null && (
                                            <p className="text-xs text-gray-500 mt-1">Demand ID: #{(job as { demand_number?: number }).demand_number}</p>
                                          )}
                                          {isAuroraManager && (job.dealers as any)?.name && (
                                            <p className="text-xs text-gray-500 mt-1">Dealer: {(job.dealers as any).name}</p>
                                          )}
                                      </div>
                                      <div className="text-right">
                                          <p className="text-sm text-green-500">Completed</p>
                                          <p className="text-xs text-gray-500">{jobTz ? formatInTimeZone(new Date(job.updated_at), jobTz, 'PPP') : format(new Date(job.updated_at), 'PPP')}</p>
                                      </div>
                                  </div>
                              </li>
                              )
                          })}
                      </ul>
                  )}
              </div>
          </div>
      </div>
    </div>
  )
}

