'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
            className="rounded p-0.5 text-zinc-900 dark:text-white transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`${n} out of 5`}
          >
            <Star
              className={`h-7 w-7 ${n <= value ? 'fill-zinc-900 dark:fill-white' : 'fill-none'} stroke-zinc-900 dark:stroke-white`}
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
  canRate: boolean
  onRated: (customerRating: number, qualityScore: number) => void
}

export function CustomerPortalRating({
  vinQuery,
  demandNumber,
  specialistName,
  ratedCustomerRating,
  ratedQualityScore,
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
  const [qualityScore, setQualityScore] = useState(
    alreadyRated ? ratedQualityScore : 0
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(alreadyRated)
  const [editing, setEditing] = useState(!alreadyRated)

  if (!canRate) {
    return null
  }

  if (!demandNumber || demandNumber.length === 0) {
    return null
  }

  async function handleSubmit() {
    if (customerRating < 1 || qualityScore < 1) {
      setError('Please rate both categories from 1 to 5 stars.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc('customer_portal_rate_specialist', {
        p_vin_query: vinQuery,
        p_demand_number: demandNumber,
        p_customer_rating: customerRating,
        p_quality_score: qualityScore,
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
      onRated(customerRating, qualityScore)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Rate your installation specialist
        </h4>
        <p className="text-xs text-zinc-500 dark:text-gray-500 mt-0.5">
          {specialistName}
        </p>
      </div>

      {submitted && !editing ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-700 dark:text-gray-300">
            Thank you for your feedback. Your ratings help us maintain service quality.
          </p>
          <p className="text-xs text-zinc-500 dark:text-gray-500">
            Customer rating: {customerRating}/5 · Quality score: {qualityScore}/5
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-zinc-700 dark:text-zinc-300 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-white"
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
          {error ? (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : submitted ? 'Save changes' : 'Submit rating'}
          </button>
        </>
      )}
    </div>
  )
}
