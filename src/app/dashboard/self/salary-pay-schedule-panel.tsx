'use client'

import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import {
  buildSalaryPayInstallments,
  normalizeSalaryPaySchedule,
  resolveMonthlySalaryAmount,
  SALARY_PAY_SCHEDULE_LABELS,
  type SalaryPayInstallment,
} from '@/lib/salary-pay-schedule'

function installmentStatus(dueDate: string, todayIso: string): 'paid' | 'upcoming' | 'due' | 'past' {
  if (dueDate < todayIso) return 'past'
  if (dueDate === todayIso) return 'due'
  return 'upcoming'
}

function statusClass(status: ReturnType<typeof installmentStatus> | 'paid'): string {
  switch (status) {
    case 'paid':
      return 'bg-green-500/20 text-green-400'
    case 'due':
      return 'bg-amber-500/20 text-amber-300'
    case 'upcoming':
      return 'bg-blue-500/20 text-blue-300'
    case 'past':
      return 'bg-zinc-500/20 text-zinc-400'
    default:
      return 'bg-zinc-500/20 text-zinc-400'
  }
}

export function SalaryPaySchedulePanel({
  salaryAmount,
  salaryType,
  salaryCurrency,
  paySchedule,
  paymentRecords,
}: {
  salaryAmount: number
  salaryType: string | null
  salaryCurrency: string | null
  paySchedule: string | null
  paymentRecords: { amount: number; paid_at: string | null; status: string; period_start: string | null }[]
}) {
  const now = new Date()
  const [year, setYear] = useState(now.getUTCFullYear())
  const [month, setMonth] = useState(now.getUTCMonth() + 1)

  const scheduleMode = normalizeSalaryPaySchedule(paySchedule)
  const monthlyAmount = resolveMonthlySalaryAmount(salaryAmount, salaryType)
  const currency = salaryCurrency ?? 'CAD'

  const installments = useMemo(
    () =>
      monthlyAmount != null
        ? buildSalaryPayInstallments({
            salaryAmount,
            salaryType,
            paySchedule: scheduleMode,
            year,
            month1to12: month,
          })
        : [],
    [monthlyAmount, salaryAmount, salaryType, scheduleMode, year, month]
  )

  const todayIso = now.toISOString().slice(0, 10)

  function matchPaidRecord(inst: SalaryPayInstallment): boolean {
    const instMonth = inst.dueDate.slice(0, 7)
    return paymentRecords.some((p) => {
      const st = (p.status ?? '').toLowerCase()
      if (st !== 'paid' && !p.paid_at) return false
      const paidDay = p.paid_at?.slice(0, 10)
      const periodMonth = p.period_start?.slice(0, 7)
      const amountMatch = Math.abs(Number(p.amount) - inst.amount) < 0.02
      if (!amountMatch) return false
      if (paidDay && paidDay.slice(0, 7) === instMonth) return true
      if (periodMonth === instMonth) return true
      return false
    })
  }

  if (monthlyAmount == null) return null

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="mb-6 rounded-lg border border-zinc-300 dark:border-gray-700 bg-white/60 dark:bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#C27E00]" />
            Salary payment schedule
          </h3>
          <p className="text-xs text-zinc-500 dark:text-gray-400 mt-0.5">
            {SALARY_PAY_SCHEDULE_LABELS[scheduleMode]} · Monthly base{' '}
            {currency} {monthlyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-2 py-1 text-xs"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {new Date(Date.UTC(2026, m - 1, 1)).toLocaleString('en-CA', { month: 'short', timeZone: 'UTC' })}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-2 py-1 text-xs"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-zinc-500 border-b border-zinc-200 dark:border-gray-800">
              <th className="py-2 pr-3">Pay date</th>
              <th className="py-2 pr-3">Installment</th>
              <th className="py-2 pr-3 text-right">Amount</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
            {installments.map((inst) => {
              const paid = matchPaidRecord(inst)
              const status = paid ? 'paid' : installmentStatus(inst.dueDate, todayIso)
              const statusLabel =
                status === 'paid'
                  ? 'Paid'
                  : status === 'due'
                    ? 'Due today'
                    : status === 'upcoming'
                      ? 'Scheduled'
                      : 'Past'
              return (
                <tr key={inst.id}>
                  <td className="py-2 pr-3 text-zinc-800 dark:text-gray-200">
                    {new Date(`${inst.dueDate}T12:00:00Z`).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-2 pr-3 text-zinc-600 dark:text-gray-300">{inst.label}</td>
                  <td className="py-2 pr-3 text-right font-medium tabular-nums text-zinc-900 dark:text-white">
                    {currency} {inst.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${statusClass(status)}`}>{statusLabel}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
