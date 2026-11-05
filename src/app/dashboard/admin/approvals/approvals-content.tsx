'use client'

import { useState } from 'react'
import { Check, ExternalLink, Loader2, Receipt, X } from 'lucide-react'
import {
  EXPENSE_CATEGORY_LABELS,
  type SpecialistExpenseCategory,
} from '@/lib/specialist-expense-claims'
import { formatDurationMinutes } from '@/lib/extra-duty-compensation'
import {
  approvePendingExpenseClaim,
  rejectPendingExpenseClaim,
  type PendingExpenseClaimRow,
} from './actions'

export function ApprovalsContent({ initialClaims }: { initialClaims: PendingExpenseClaimRow[] }) {
  const [claims, setClaims] = useState(initialClaims)
  const [filter, setFilter] = useState<SpecialistExpenseCategory | 'all'>('all')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered =
    filter === 'all' ? claims : claims.filter((c) => c.category === filter)

  async function approve(claimId: string) {
    setLoadingId(claimId)
    setError(null)
    const res = await approvePendingExpenseClaim(claimId)
    setLoadingId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    setClaims((prev) => prev.filter((c) => c.id !== claimId))
  }

  async function reject(claimId: string) {
    if (!rejectReason.trim()) {
      setError('Enter a rejection reason.')
      return
    }
    setLoadingId(claimId)
    setError(null)
    const res = await rejectPendingExpenseClaim(claimId, rejectReason)
    setLoadingId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    setRejectId(null)
    setRejectReason('')
    setClaims((prev) => prev.filter((c) => c.id !== claimId))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <Receipt className="h-7 w-7 text-[#C27E00]" />
          Onaylar (Approvals)
        </h1>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">
          Pending expense and Extra Duty claims. Approved items are scheduled for the next salary pay date.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400 rounded-lg border border-red-900/30 bg-red-950/20 px-3 py-2">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
        {(['travel', 'meals', 'fuel', 'extra_duty'] as SpecialistExpenseCategory[]).map((cat) => (
          <FilterChip
            key={cat}
            active={filter === cat}
            onClick={() => setFilter(cat)}
            label={EXPENSE_CATEGORY_LABELS[cat]}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-zinc-500">No pending claims.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-zinc-200 dark:border-gray-800 bg-white/80 dark:bg-white/5 p-4"
            >
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{c.submitter_name ?? c.profile_id}</p>
                  <p className="text-xs text-zinc-500">
                    {EXPENSE_CATEGORY_LABELS[c.category]} · {c.expense_date}
                  </p>
                </div>
                <p className="text-lg font-semibold tabular-nums text-[#C27E00]">
                  ${Number(c.amount).toFixed(2)} CAD
                </p>
              </div>
              <p className="text-sm text-zinc-700 dark:text-gray-300 mb-2">{c.description}</p>
              {c.category === 'extra_duty' && c.duration_minutes != null ? (
                <p className="text-xs text-zinc-500 mb-2">
                  Duration: {formatDurationMinutes(c.duration_minutes)}
                  {c.hourly_rate_used != null ? ` · Rate $${Number(c.hourly_rate_used).toFixed(2)}/hr` : ''}
                </p>
              ) : null}
              {c.receipt_drive_url ? (
                <a
                  href={c.receipt_drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#C27E00] hover:underline mb-3"
                >
                  View receipt <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}

              {rejectId === c.id ? (
                <div className="space-y-2 mt-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Rejection reason (required)"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={loadingId === c.id}
                      onClick={() => void reject(c.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      {loadingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectId(null)
                        setRejectReason('')
                      }}
                      className="text-sm text-zinc-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    disabled={loadingId === c.id}
                    onClick={() => void approve(c.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  >
                    {loadingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={loadingId === c.id}
                    onClick={() => {
                      setRejectId(c.id)
                      setRejectReason('')
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? 'bg-[#C27E00] text-white'
          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-gray-300'
      }`}
    >
      {label}
    </button>
  )
}
