'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MAX_COMMENT = 500

function StarRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</p>
      <div className="flex items-center gap-0.5" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            aria-pressed={n <= value}
            className="rounded p-0.5 text-[#C27E00] transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`${n} out of 5 stars`}
          >
            <Star
              className={`h-7 w-7 ${n <= value ? 'fill-[#C27E00]' : 'fill-none'} stroke-[#C27E00]`}
              strokeWidth={1.25}
            />
          </button>
        ))}
        <span className="ml-2 text-xs tabular-nums text-zinc-500 dark:text-gray-500">
          {value > 0 ? `${value}/5` : '—'}
        </span>
      </div>
    </div>
  )
}

type Props = {
  vinQuery: string
  demandNumber: string | null
  specialistName: string
  ratedCustomerRating: number | null
  ratedQualityScore: number | null
  ratedComment: string
  canRate: boolean
  onRated: (customerRating: number, qualityScore: number, comment: string) => void
}

export function RatingPanel({
  vinQuery,
  demandNumber,
  specialistName,
  ratedCustomerRating,
  ratedQualityScore,
  ratedComment,
  canRate,
  onRated,
}: Props) {
  const alreadyRated =
    ratedCustomerRating != null &&
    ratedQualityScore != null &&
    ratedCustomerRating >= 1 &&
    ratedQualityScore >= 1

  const [customerRating, setCustomerRating] = useState(
    alreadyRated ? ratedCustomerRating : 0
  )
  const [qualityScore, setQualityScore] = useState(alreadyRated ? ratedQualityScore : 0)
  const [comment, setComment] = useState(ratedComment || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(alreadyRated)
  const [editing, setEditing] = useState(!alreadyRated)

  if (!canRate || !demandNumber?.trim()) return null

  async function handleSubmit() {
    if (customerRating < 1 || qualityScore < 1) {
      setError('Please rate both categories from 1 to 5 stars.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const supabase = createClient()
      const trimmedComment = comment.trim().slice(0, MAX_COMMENT)
      const { data, error: rpcError } = await supabase.rpc('customer_portal_rate_specialist', {
        p_vin_query: vinQuery,
        p_demand_number: demandNumber,
        p_customer_rating: customerRating,
        p_quality_score: qualityScore,
        p_comment: trimmedComment || null,
      })

      if (rpcError) {
        console.error('customer_portal_rate_specialist', rpcError)
        setError('Could not save your rating. Please try again.')
        return
      }

      const result = data as { ok?: boolean; error?: string } | null
      if (!result?.ok) {
        setError(result?.error ?? 'Could not save your rating.')
        return
      }

      setSubmitted(true)
      setEditing(false)
      onRated(customerRating, qualityScore, trimmedComment)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Rate your installation specialist
        </h3>
        <p className="text-xs text-zinc-500 dark:text-gray-500 mt-0.5">{specialistName}</p>
      </div>

      {submitted && !editing ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-700 dark:text-gray-300">
            Thank you for your feedback. Your ratings help us maintain service quality.
          </p>
          <p className="text-xs text-zinc-500 dark:text-gray-500">
            Customer rating: {customerRating}/5 · Quality score: {qualityScore}/5
          </p>
          {comment.trim() ? (
            <p className="text-xs text-zinc-600 dark:text-gray-400 italic border-l-2 border-[#C27E00]/40 pl-2">
              &ldquo;{comment.trim()}&rdquo;
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-[#C27E00] hover:underline"
          >
            Update your rating
          </button>
        </div>
      ) : (
        <>
          <StarRow
            label="Customer rating"
            value={customerRating}
            onChange={setCustomerRating}
            disabled={submitting}
          />
          <StarRow
            label="Quality score"
            value={qualityScore}
            onChange={setQualityScore}
            disabled={submitting}
          />
          <div className="space-y-1.5">
            <label htmlFor={`comment-${demandNumber}`} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Comments (optional)
            </label>
            <textarea
              id={`comment-${demandNumber}`}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
              disabled={submitting}
              rows={3}
              placeholder="Tell us about your installation experience…"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#C27E00]/40"
            />
            <p className="text-[11px] text-zinc-400 text-right">{comment.length}/{MAX_COMMENT}</p>
          </div>
          {error ? (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-lg bg-[#C27E00] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#a06900] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving…' : submitted ? 'Save changes' : 'Submit rating'}
          </button>
        </>
      )}
    </section>
  )
}
