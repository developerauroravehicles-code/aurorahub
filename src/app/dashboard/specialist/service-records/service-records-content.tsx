'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatInPT } from '@/lib/timezone-defaults'
import { diagnosisLabel, serviceRecordStatusLabel } from '@/lib/customer-service-record-utils'
import type { CustomerServiceRecord, ServiceRecordExpense } from '@/types/customer-service-record'
import {
  completeServiceRecord,
  fetchExpensesForRecord,
  startServiceRecord,
  submitServiceRecordExpense,
} from './actions'
import { Building2, Car, Check, Loader2, Plus, User, Wrench } from 'lucide-react'

type Props = {
  records: CustomerServiceRecord[]
}

const EXPENSE_CATEGORIES = [
  { value: 'travel' as const, label: 'Travel' },
  { value: 'meals' as const, label: 'Meals' },
  { value: 'other' as const, label: 'Other' },
]

export function SpecialistServiceRecordsContent({ records }: Props) {
  const router = useRouter()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<ServiceRecordExpense[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [completionNotes, setCompletionNotes] = useState('')
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState<'travel' | 'meals' | 'other'>('travel')

  const activeRecord = useMemo(
    () => records.find((r) => r.id === activeId) ?? null,
    [records, activeId]
  )

  async function openRecord(record: CustomerServiceRecord) {
    setActiveId(record.id)
    setMessage(null)
    setError(null)
    setCompletionNotes('')
    setLoadingExpenses(true)
    const rows = await fetchExpensesForRecord(record.id)
    setExpenses(rows)
    setLoadingExpenses(false)
  }

  async function handleStart(recordId: string) {
    setSubmitting(true)
    setError(null)
    const result = await startServiceRecord(recordId)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setMessage('Job marked in progress.')
    router.refresh()
  }

  async function handleComplete(recordId: string) {
    setSubmitting(true)
    setError(null)
    const result = await completeServiceRecord(recordId, completionNotes)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setMessage('Job completed. $20 service fee recorded for payroll.')
    setActiveId(null)
    router.refresh()
  }

  async function handleAddExpense(recordId: string) {
    setSubmitting(true)
    setError(null)
    const result = await submitServiceRecordExpense(
      recordId,
      expenseDesc,
      parseFloat(expenseAmount),
      expenseCategory
    )
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setExpenseDesc('')
    setExpenseAmount('')
    setMessage('Expense submitted for manager approval.')
    const rows = await fetchExpensesForRecord(recordId)
    setExpenses(rows)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Service Jobs</h1>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">
          Assigned dashcam service requests. Complete the job and submit expenses for reimbursement.
        </p>
      </div>

      {message ? (
        <p className="text-sm text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 p-3">
          {message}
        </p>
      ) : null}

      {records.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-gray-400 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center">
          No service jobs assigned to you right now.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {records.map((record) => (
            <article
              key={record.id}
              className={`rounded-xl border p-4 space-y-3 cursor-pointer transition-colors ${
                activeId === record.id
                  ? 'border-[#C27E00] bg-[#C27E00]/5'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-[#C27E00]/40'
              }`}
              onClick={() => void openRecord(record)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  void openRecord(record)
                }
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-[#C27E00] font-medium">#{record.demand_number}</p>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{record.vehicle_summary}</h2>
                </div>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  {serviceRecordStatusLabel(record.status)}
                </span>
              </div>
              <p className="text-sm text-zinc-600 dark:text-gray-400 flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" />
                {diagnosisLabel(record.diagnosis_code, record.diagnosis_other)}
              </p>
              {record.service_appointment_at ? (
                <p className="text-xs text-zinc-500">
                  {formatInPT(record.service_appointment_at, 'EEEE, MMM d · h:mm a')} PT · {record.service_location}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {activeRecord ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Job details</h2>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="flex gap-2">
              <User className="h-4 w-4 text-[#C27E00] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{activeRecord.customer_firstname || 'Customer'}</p>
                <p className="text-zinc-500">{activeRecord.customer_phone}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Car className="h-4 w-4 text-[#C27E00] shrink-0 mt-0.5" />
              <p>{activeRecord.vehicle_summary}</p>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Building2 className="h-4 w-4 text-[#C27E00] shrink-0 mt-0.5" />
              <p>{activeRecord.dealer_name}</p>
            </div>
          </div>

          {activeRecord.comment?.trim() ? (
            <p className="text-sm text-zinc-600 dark:text-gray-400 border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
              {activeRecord.comment.trim()}
            </p>
          ) : null}

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            {activeRecord.status === 'assigned' ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleStart(activeRecord.id)}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Start job
              </button>
            ) : null}
            {activeRecord.status === 'assigned' || activeRecord.status === 'in_progress' ? (
              <>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value.slice(0, 500))}
                  rows={2}
                  placeholder="Completion notes (optional)"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleComplete(activeRecord.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Complete job (+$20)
                </button>
              </>
            ) : null}
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Submit expense
            </h3>
            <div className="grid sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                placeholder="Description"
                className="sm:col-span-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="Amount CAD"
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value as typeof expenseCategory)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={submitting || !expenseDesc.trim() || !expenseAmount}
                onClick={() => void handleAddExpense(activeRecord.id)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                Add expense
              </button>
            </div>

            {loadingExpenses ? (
              <p className="text-xs text-zinc-500">Loading expenses…</p>
            ) : expenses.length > 0 ? (
              <ul className="text-xs space-y-1.5">
                {expenses.map((exp) => (
                  <li key={exp.id} className="flex justify-between gap-2 text-zinc-600 dark:text-gray-400">
                    <span>
                      {exp.description} · {exp.category} · {exp.status}
                    </span>
                    <span className="tabular-nums font-medium">${Number(exp.amount).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
