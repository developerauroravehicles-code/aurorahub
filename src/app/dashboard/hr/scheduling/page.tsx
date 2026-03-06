import { createClient } from '@/lib/supabase/server'
import { SchedulingContent } from './scheduling-content'

export default async function SchedulingPage() {
  const supabase = await createClient()

  const [
    { data: availability },
    { data: leaveBlocks },
    { data: personnel },
  ] = await Promise.all([
    supabase
      .from('personnel_availability')
      .select('id, personnel_id, day_of_week, start_time, end_time, is_available, valid_from, valid_to, notes, personnel(full_name)')
      .order('personnel_id'),
    supabase
      .from('personnel_leave_blocks')
      .select('id, personnel_id, start_date, end_date, reason, personnel(full_name)')
      .order('start_date', { ascending: false }),
    supabase.from('personnel').select('id, full_name').order('full_name'),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Scheduling & Availability</h1>
        <p className="text-gray-400">Field technician availability, time slots, vacation, dispatch integration.</p>
      </div>
      <SchedulingContent
        availability={availability ?? []}
        leaveBlocks={leaveBlocks ?? []}
        personnel={personnel ?? []}
      />
    </div>
  )
}
