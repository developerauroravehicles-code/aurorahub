import { createClient } from '@/lib/supabase/server'
import { PerformanceContent } from './performance-content'

export default async function PerformancePage() {
  const supabase = await createClient()
  const [metricsRes, feedbackRes, reviewsRes, personnelRes] = await Promise.all([
    supabase.from('performance_metrics').select('*, personnel(full_name)').order('created_at', { ascending: false }),
    supabase.from('performance_feedback').select('*, personnel(full_name)').order('created_at', { ascending: false }),
    supabase.from('performance_reviews').select('*, personnel(full_name), reviewer:personnel!reviewer_id(full_name)').order('review_date', { ascending: false }),
    supabase.from('personnel').select('id, full_name').order('full_name'),
  ])
  const metrics = metricsRes.data ?? []
  const feedback = feedbackRes.data ?? []
  const reviews = reviewsRes.data ?? []
  const personnel = personnelRes.data ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Performance & Quality</h1>
        <p className="text-gray-400">Installation success rate, customer satisfaction, rework rate, feedback, and performance reviews.</p>
      </div>
      <PerformanceContent metrics={metrics} feedback={feedback} reviews={reviews} personnel={personnel} />
    </div>
  )
}
