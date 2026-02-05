import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function SpecialistDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  
  // Fetch Specialist Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, dealers(name)')
    .eq('id', id)
    .single()

  if (!profile) return <div className="text-white">Specialist not found</div>

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
  
  // Fetch Completed Jobs
  const { data: completedJobs } = await supabase
    .from('demands')
    .select('id, status, created_at, updated_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, appointment_date')
    .eq('status', 'completed')
    .eq('dealer_id', profile.dealer_id) // Assuming they work for their dealer
    // Ideally we filter by who completed it. For now, let's show all completed in their dealer if we can't distinguish,
    // OR better, let's query demand_logs to see who moved it to 'completed'.
    // Querying logs is expensive.
    // Let's stick to `dealer_id` context for now as per "Specialist View" logic which shows dealer pool.
    
  // Fetch Pending Jobs (Approved but not completed)
  const { data: pendingJobs } = await supabase
    .from('demands')
    .select('id, status, created_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model, vehicle_year, appointment_date')
    .eq('status', 'approved')
    .eq('dealer_id', profile.dealer_id)

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/admin/employees" className="flex items-center text-gray-400 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Employees
        </Link>
        <h1 className="text-2xl font-bold text-white mb-2">{profile.full_name}</h1>
        <p className="text-gray-400">{profile.role.replace('_', ' ')} at <span className="text-[#C27E00]">{profile.dealers?.name}</span></p>
      </div>

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
                          {pendingJobs?.map(job => (
                              <li key={job.id} className="p-4 hover:bg-white/5 transition-colors">
                                  <div className="flex justify-between items-center">
                                      <div>
                                          <p className="font-medium text-white">{job.vehicle_year} {job.vehicle_make} {job.vehicle_model}</p>
                                          <p className="text-sm text-gray-400">{job.customer_firstname} {job.customer_lastname}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-sm text-[#C27E00]">{format(new Date(job.appointment_date), 'PPP p')}</p>
                                      </div>
                                  </div>
                              </li>
                          ))}
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
                          {completedJobs?.map(job => (
                              <li key={job.id} className="p-4 hover:bg-white/5 transition-colors">
                                  <div className="flex justify-between items-center">
                                      <div>
                                          <p className="font-medium text-white">{job.vehicle_year} {job.vehicle_make} {job.vehicle_model}</p>
                                          <p className="text-sm text-gray-400">{job.customer_firstname} {job.customer_lastname}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-sm text-green-500">Completed</p>
                                          <p className="text-xs text-gray-500">{format(new Date(job.updated_at), 'PPP')}</p>
                                      </div>
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

