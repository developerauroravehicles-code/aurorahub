import { createClient } from '@/lib/supabase/server'
import { TrainingContent } from './training-content'

export default async function TrainingPage() {
  const supabase = await createClient()

  const [
    { data: programs },
    { data: completions },
    { data: certifications },
    { data: personnel },
  ] = await Promise.all([
    supabase.from('training_programs').select('*').order('name'),
    supabase
      .from('personnel_training_completions')
      .select('id, personnel_id, completed_at, personnel(full_name), training_programs(name)')
      .order('completed_at', { ascending: false }),
    supabase
      .from('personnel_certifications')
      .select('id, personnel_id, certification_type, name, institution, issue_date, expiry_date, status, personnel(full_name)')
      .order('expiry_date', { ascending: true, nullsFirst: false }),
    supabase.from('personnel').select('id, full_name').order('full_name'),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Training & Certification</h1>
        <p className="text-gray-400">Training programs, certification tracking, renewal reminders.</p>
      </div>
      <TrainingContent
        programs={programs ?? []}
        completions={completions ?? []}
        certifications={certifications ?? []}
        personnel={personnel ?? []}
      />
    </div>
  )
}
