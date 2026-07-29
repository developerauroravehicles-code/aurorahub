'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, Plus, Receipt } from 'lucide-react'
import {
  EXPENSE_CATEGORY_LABELS,
  type SpecialistExpenseCategory,
  type SpecialistExpenseClaim,
} from '@/lib/specialist-expense-claims'
import { submitSpecialistExpenseClaim } from './expense-actions'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
}

type Props = {
  initialClaims: SpecialistExpenseClaim[]
}

export function SelfExpensesPanel({ initialClaims }: Props) {
  const [claims, setClaims] = useState(initialClaims)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#C27E00]" />
            Expenses (Giderler)
          </h2>
          <p className="text-sm text-zinc-500 dark:text-gray-400 mt-0.5">
            Submit receipts for reimbursement. Approved amounts appear in Pay estimate.
          </p>
        </div>
        {!showForm ? (
          <button
            type="button"
            onClick={() => {
              setShowForm(true)
              setError(null)
              setSuccess(false)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#C27E00] px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            New expense
          </button>
        ) : null}
      </div>

      {success ? (
        <p className="text-sm text-green-600 dark:text-green-400">Expense submitted for approval.</p>
      ) : null}

      {showForm ? (
        <form
          action={async (formData: FormData) => {
            setSubmitting(true)
            setError(null)
            setSuccess(false)
            const result = await submitSpecialistExpenseClaim(formData)
            setSubmitting(false)
            if (result.error) {
              setError(result.error)
              return
            }
            setSuccess(true)
            setShowForm(false)
            window.location.reload()
          }}
          className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100/90 dark:bg-black/30 p-4 space-y-4"
        >
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Submit expense</h3>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-500 mb-1">Description *</label>
              <input
                name="description"
                required
                maxLength={300}
                placeholder="e.g. Five Guys lunch — dealer visit"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Amount (CAD) *</label>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Expense date *</label>
              <input
                name="expense_date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Category</label>
              <select
                name="category"
                defaultValue="meals"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              >
                {(Object.keys(EXPENSE_CATEGORY_LABELS) as SpecialistExpenseCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {EXPENSE_CATEGORY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Receipt photo / PDF *</label>
              <input
                name="receipt"
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                className="w-full text-sm text-zinc-600 dark:text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-[#C27E00] file:px-3 file:py-1.5 file:text-sm file:text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">Max 8 MB. Saved to Google Drive.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C27E00] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit for approval
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {claims.length === 0 ? (
        <p className="text-sm text-zinc-500">No expense claims yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {claims.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-zinc-500">{c.expense_date}</td>
                  <td className="px-3 py-2 text-zinc-800 dark:text-gray-200">
                    {c.description}
                    {c.status === 'rejected' && c.rejection_reason ? (
                      <span className="block text-xs text-red-500 mt-0.5">{c.rejection_reason}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {EXPENSE_CATEGORY_LABELS[c.category] ?? c.category}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    ${Number(c.amount).toFixed(2)}
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
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-zinc-500 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
