'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createPerformanceMetric,
  updatePerformanceMetric,
  deletePerformanceMetric,
  createPerformanceFeedback,
  updatePerformanceFeedback,
  deletePerformanceFeedback,
  createPerformanceReview,
  updatePerformanceReview,
  deletePerformanceReview,
} from './actions'
import { Pencil, Trash2, Plus, BarChart3, MessageSquare, ClipboardCheck, Loader2 } from 'lucide-react'

const METRIC_TYPES: Record<string, string> = {
  installation_success_rate: 'Installation Success Rate %',
  customer_satisfaction: 'Customer Satisfaction (1-5)',
  rework_rate: 'Rework Rate %',
  completion_rate: 'Completion Rate %',
  quality_score: 'Quality Score (0-5)',
  on_time_rate: 'On-Time Rate %',
  first_time_fix: 'First Time Fix %',
  other: 'Other',
}

const FEEDBACK_TYPES: Record<string, string> = {
  customer: 'Customer',
  manager: 'Manager',
  peer: 'Peer',
  self_assessment: 'Self Assessment',
  quality_audit: 'Quality Audit',
  dealer: 'Dealer',
  other: 'Other',
}

const REVIEW_STATUSES: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function PerformanceContent({
  metrics,
  feedback,
  reviews,
  personnel,
}: {
  metrics: {
    id: string
    personnel_id: string
    metric_type: string | null
    value: number | null
    period_start: string | null
    period_end: string | null
    personnel: { full_name: string } | null
  }[]
  feedback: {
    id: string
    personnel_id: string
    feedback_type: string | null
    source: string | null
    rating: number | null
    comment: string | null
    personnel: { full_name: string } | null
  }[]
  reviews: {
    id: string
    personnel_id: string
    review_date: string
    reviewer_id: string | null
    rating: number | null
    notes: string | null
    status: string | null
    personnel: { full_name: string } | null
    reviewer: { full_name: string } | null
  }[]
  personnel: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'metrics' | 'feedback' | 'reviews'>('metrics')
  const [showMetricForm, setShowMetricForm] = useState(false)
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null)
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-zinc-200 dark:border-gray-800 pb-2">
        {(['metrics', 'feedback', 'reviews'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab
                ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white border border-b-0 border-zinc-200 dark:border-gray-800'
                : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white hover:bg-zinc-200/50 dark:bg-white/5'
            }`}
          >
            {tab === 'metrics' && <BarChart3 className="w-4 h-4" />}
            {tab === 'feedback' && <MessageSquare className="w-4 h-4" />}
            {tab === 'reviews' && <ClipboardCheck className="w-4 h-4" />}
            {tab === 'metrics' && 'Metrics'}
            {tab === 'feedback' && 'Feedback'}
            {tab === 'reviews' && 'Reviews'}
          </button>
        ))}
      </div>

      {activeTab === 'metrics' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Performance Metrics</h2>
            <button
              onClick={() => { setEditingMetricId(null); setShowMetricForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> Add Metric
            </button>
          </div>
          {showMetricForm && (
            <MetricForm
              personnel={personnel}
              metric={editingMetricId ? metrics.find((m) => m.id === editingMetricId) : null}
              onClose={() => { setShowMetricForm(false); setEditingMetricId(null) }}
              onSuccess={() => { router.refresh(); setShowMetricForm(false); setEditingMetricId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Value</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Period</th>
                  <th className="px-4 py-2 text-right text-zinc-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                {metrics.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 text-zinc-900 dark:text-white">
                      <Link href={`/dashboard/hr/personnel/${m.personnel_id}`} className="text-[#C27E00] hover:underline">
                        {m.personnel?.full_name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{METRIC_TYPES[m.metric_type ?? ''] ?? m.metric_type ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{m.value != null ? Number(m.value).toFixed(2) : '—'}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">
                      {m.period_start && m.period_end
                        ? `${new Date(m.period_start).toLocaleDateString()} – ${new Date(m.period_end).toLocaleDateString()}`
                        : m.period_start
                          ? new Date(m.period_start).toLocaleDateString()
                          : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingMetricId(m.id); setShowMetricForm(true) }} className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete this metric?')) { await deletePerformanceMetric(m.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {metrics.length === 0 && !showMetricForm && (
              <p className="text-zinc-500 dark:text-gray-500 py-6 text-center">No metrics yet. Add success rates, quality scores, etc.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Performance Feedback</h2>
            <button
              onClick={() => { setEditingFeedbackId(null); setShowFeedbackForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> Add Feedback
            </button>
          </div>
          {showFeedbackForm && (
            <FeedbackForm
              personnel={personnel}
              item={editingFeedbackId ? feedback.find((f) => f.id === editingFeedbackId) : null}
              onClose={() => { setShowFeedbackForm(false); setEditingFeedbackId(null) }}
              onSuccess={() => { router.refresh(); setShowFeedbackForm(false); setEditingFeedbackId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Source</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Rating</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Comment</th>
                  <th className="px-4 py-2 text-right text-zinc-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                {feedback.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-2 text-zinc-900 dark:text-white">
                      <Link href={`/dashboard/hr/personnel/${f.personnel_id}`} className="text-[#C27E00] hover:underline">
                        {f.personnel?.full_name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{FEEDBACK_TYPES[f.feedback_type ?? ''] ?? f.feedback_type ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{f.source ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{f.rating != null ? Number(f.rating).toFixed(1) : '—'}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400 max-w-[200px] truncate">{f.comment ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingFeedbackId(f.id); setShowFeedbackForm(true) }} className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete?')) { await deletePerformanceFeedback(f.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {feedback.length === 0 && !showFeedbackForm && (
              <p className="text-zinc-500 dark:text-gray-500 py-6 text-center">No feedback yet. Add customer, manager, or quality feedback.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Performance Reviews</h2>
            <button
              onClick={() => { setEditingReviewId(null); setShowReviewForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> Add Review
            </button>
          </div>
          {showReviewForm && (
            <ReviewForm
              personnel={personnel}
              review={editingReviewId ? reviews.find((r) => r.id === editingReviewId) : null}
              onClose={() => { setShowReviewForm(false); setEditingReviewId(null) }}
              onSuccess={() => { router.refresh(); setShowReviewForm(false); setEditingReviewId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Reviewer</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Rating</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-2 text-right text-zinc-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-zinc-900 dark:text-white">
                      <Link href={`/dashboard/hr/personnel/${r.personnel_id}`} className="text-[#C27E00] hover:underline">
                        {r.personnel?.full_name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{new Date(r.review_date).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{r.reviewer?.full_name ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{r.rating != null ? Number(r.rating).toFixed(1) : '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        r.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        r.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                        r.status === 'cancelled' ? 'bg-gray-600 text-zinc-500 dark:text-gray-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {REVIEW_STATUSES[r.status ?? ''] ?? r.status ?? 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingReviewId(r.id); setShowReviewForm(true) }} className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete this review?')) { await deletePerformanceReview(r.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reviews.length === 0 && !showReviewForm && (
              <p className="text-zinc-500 dark:text-gray-500 py-6 text-center">No reviews yet. Schedule periodic performance reviews.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricForm({ personnel, metric, onClose, onSuccess }: {
  personnel: { id: string; full_name: string }[]
  metric: { id: string; personnel_id: string; metric_type: string | null; value: number | null; period_start: string | null; period_end: string | null } | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!metric

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const valueVal = (form.elements.namedItem('value') as HTMLInputElement).value
    const data = {
      metric_type: (form.elements.namedItem('metric_type') as HTMLSelectElement).value || undefined,
      value: valueVal ? parseFloat(valueVal) : undefined,
      period_start: (form.elements.namedItem('period_start') as HTMLInputElement).value || undefined,
      period_end: (form.elements.namedItem('period_end') as HTMLInputElement).value || undefined,
    }
    const result = metric
      ? await updatePerformanceMetric(metric.id, data)
      : await createPerformanceMetric({
          personnel_id: (form.elements.namedItem('personnel_id') as HTMLSelectElement).value,
          ...data,
        })
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 space-y-3">
      <h3 className="text-zinc-900 dark:text-white font-medium">{isEdit ? 'Edit Metric' : 'Add Metric'}</h3>
      {!isEdit && (
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Personnel</label>
          <select name="personnel_id" required className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
            <option value="">Select...</option>
            {personnel.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Metric Type</label>
          <select name="metric_type" defaultValue={metric?.metric_type ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
            <option value="">—</option>
            {Object.entries(METRIC_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Value</label>
          <input name="value" type="number" step="0.01" defaultValue={metric?.value != null ? String(metric.value) : ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" placeholder="e.g. 95.5" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Period Start</label>
          <input name="period_start" type="date" defaultValue={metric?.period_start ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Period End</label>
          <input name="period_end" type="date" defaultValue={metric?.period_end ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Add')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}

function FeedbackForm({ personnel, item, onClose, onSuccess }: {
  personnel: { id: string; full_name: string }[]
  item: { id: string; personnel_id: string; feedback_type: string | null; source: string | null; rating: number | null; comment: string | null } | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!item

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const ratingVal = (form.elements.namedItem('rating') as HTMLInputElement).value
    const data = {
      feedback_type: (form.elements.namedItem('feedback_type') as HTMLSelectElement).value || undefined,
      source: (form.elements.namedItem('source') as HTMLInputElement).value.trim() || undefined,
      rating: ratingVal ? parseFloat(ratingVal) : undefined,
      comment: (form.elements.namedItem('comment') as HTMLTextAreaElement).value.trim() || undefined,
    }
    const result = item
      ? await updatePerformanceFeedback(item.id, data)
      : await createPerformanceFeedback({
          personnel_id: (form.elements.namedItem('personnel_id') as HTMLSelectElement).value,
          ...data,
        })
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 space-y-3">
      <h3 className="text-zinc-900 dark:text-white font-medium">{isEdit ? 'Edit Feedback' : 'Add Feedback'}</h3>
      {!isEdit && (
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Personnel</label>
          <select name="personnel_id" required className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
            <option value="">Select...</option>
            {personnel.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Feedback Type</label>
          <select name="feedback_type" defaultValue={item?.feedback_type ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
            <option value="">—</option>
            {Object.entries(FEEDBACK_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Source</label>
          <input name="source" defaultValue={item?.source ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" placeholder="e.g. Job #1234" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Rating (1-5)</label>
          <input name="rating" type="number" step="0.1" min="1" max="5" defaultValue={item?.rating != null ? String(item.rating) : ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Comment</label>
        <textarea name="comment" rows={2} defaultValue={item?.comment ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Add')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}

function ReviewForm({ personnel, review, onClose, onSuccess }: {
  personnel: { id: string; full_name: string }[]
  review: { id: string; personnel_id: string; review_date: string; reviewer_id: string | null; rating: number | null; notes: string | null; status: string | null } | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!review

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const ratingVal = (form.elements.namedItem('rating') as HTMLInputElement).value
    const data = {
      review_date: (form.elements.namedItem('review_date') as HTMLInputElement).value,
      reviewer_id: (form.elements.namedItem('reviewer_id') as HTMLSelectElement).value || undefined,
      rating: ratingVal ? parseFloat(ratingVal) : undefined,
      notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value.trim() || undefined,
      status: (form.elements.namedItem('status') as HTMLSelectElement).value || undefined,
    }
    const result = review
      ? await updatePerformanceReview(review.id, data)
      : await createPerformanceReview({
          personnel_id: (form.elements.namedItem('personnel_id') as HTMLSelectElement).value,
          ...data,
        })
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 space-y-3">
      <h3 className="text-zinc-900 dark:text-white font-medium">{isEdit ? 'Edit Review' : 'Add Review'}</h3>
      {!isEdit && (
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Personnel</label>
          <select name="personnel_id" required className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
            <option value="">Select...</option>
            {personnel.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Review Date</label>
          <input name="review_date" type="date" required defaultValue={review?.review_date ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Reviewer</label>
          <select name="reviewer_id" defaultValue={review?.reviewer_id ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
            <option value="">—</option>
            {personnel.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Rating (1-5)</label>
          <input name="rating" type="number" step="0.1" min="1" max="5" defaultValue={review?.rating != null ? String(review.rating) : ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Status</label>
          <select name="status" defaultValue={review?.status ?? 'draft'} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
            {Object.entries(REVIEW_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Notes</label>
        <textarea name="notes" rows={3} defaultValue={review?.notes ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Add')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}
