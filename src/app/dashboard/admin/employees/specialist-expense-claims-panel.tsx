'use client'

import { useState } from 'react'
import { Check, ExternalLink, Loader2, Receipt, X } from 'lucide-react'
import {
  EXPENSE_CATEGORY_LABELS,
  type SpecialistExpenseClaim,
} from '@/lib/specialist-expense-claims'
import {
  approveSpecialistExpenseClaim,
  rejectSpecialistExpenseClaim,
} from './expense-claim-actions'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  approved: 'bg-green-500/20 text-green-700 dark:text-green-300',
  rejected: 'bg-red-500/20 text-red-700 dark:text-red-300',
}

type Props = {
  profileId: string
  initialClaims: SpecialistExpenseClaim[]
}

export function SpecialistExpenseClaimsPanel({ profileId, initialClaims }: Props) {
  const [claims, setClaims] = useState(initialClaims)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pendingCount = claims.filter((c) => c.status === 'pending').length

  async function handleApprove(claimId: string) {
    setLoading(true)
    setError(null)
    const result = await approveSpecialistExpenseClaim(claimId, profileId)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' as const } : c))
    )
    window.location.reload()
  }

  async function handleReject(claimId: string) {
    if (!rejectReason.trim()) {
      setError('Enter a rejection reason.')
      return
    }
    setLoading(true)
    setError(null)
    const result = await rejectSpecialistExpenseClaim(claimId, profileId, rejectReason)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setActiveId(null)
    setRejectReason('')
    window.location.reload()
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#C27E00]" />
            Expense claims
          </h2>
          <p className="text-sm text-zinc-500 dark:text-gray-400 mt-0.5">
            Approve or reject specialist-submitted expenses. Receipts are stored on Google Drive.
          </p>
        </div>
        {pendingCount > 0 ? (
          <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-3 py-1 text-xs font-semibold">
            {pendingCount} pending
          </span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {claims.length === 0 ? (
        <p className="text-sm text-zinc-500">No expense claims submitted.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Receipt</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {claims.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">{c.expense_date}</td>
                  <td className="px-3 py-2 text-zinc-800 dark:text-gray-200">
                    <span className="font-medium">{c.description}</span>
                    <span className="block text-xs text-zinc-500">
                      {EXPENSE_CATEGORY_LABELS[c.category] ?? c.category}
                    </span>
                    {c.status === 'rejected' && c.rejection_reason ? (
                      <span className="block text-xs text-red-500 mt-0.5">{c.rejection_reason}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    ${Number(c.amount).toFixed(2)} CAD
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs capitalize ${STATUS_STYLES[c.status] ?? ''}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {c.receipt_drive_url ? (
                      <a
                        href={c.receipt_drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#C27E00] hover:underline text-xs"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.status === 'pending' ? (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void handleApprove(c.id)}
                          className="inline-flex items-center gap-1 rounded bg-green-600 hover:bg-green-700 text-white px-2 py-1 text-xs disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            setActiveId(activeId === c.id ? null : c.id)
                            setRejectReason('')
                            setError(null)
                          }}
                          className="inline-flex items-center gap-1 rounded bg-red-600/90 hover:bg-red-700 text-white px-2 py-1 text-xs disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeId ? (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20 p-4 space-y-2">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">Rejection reason</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Why is this expense rejected?"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleReject(activeId)}
              className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Confirm reject
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveId(null)
                setRejectReason('')
              }}
              className="rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
