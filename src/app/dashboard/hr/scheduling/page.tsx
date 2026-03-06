import { createClient } from '@/lib/supabase/server'
import { SchedulingContent } from './scheduling-content'

function normPersonnel(p: unknown): { full_name: string } | null {
  if (!p) return null
  const arr = Array.isArray(p) ? p : [p]
  const first = arr[0] as { full_name?: string } | undefined
  return first ? { full_name: first.full_name ?? '' } : null
}

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

  const normAvailability = (availability ?? []).map((a: Record<string, unknown>) => ({
    ...a,
    personnel: normPersonnel(a.personnel),
  })) as Parameters<typeof SchedulingContent>[0]['availability']

  const normLeaveBlocks = (leaveBlocks ?? []).map((b: Record<string, unknown>) => ({
    ...b,
    personnel: normPersonnel(b.personnel),
  })) as Parameters<typeof SchedulingContent>[0]['leaveBlocks']

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Scheduling & Availability</h1>
        <p className="text-gray-400">Field technician availability, time slots, vacation, dispatch integration.</p>
      </div>
      <SchedulingContent
        availability={normAvailability}
        leaveBlocks={normLeaveBlocks}
        personnel={personnel ?? []}
      />
    </div>
  )
}
