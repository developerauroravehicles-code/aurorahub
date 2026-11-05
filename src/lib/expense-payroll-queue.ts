import type { SalaryPayScheduleMode } from '@/lib/salary-pay-schedule'
import { normalizeSalaryPaySchedule } from '@/lib/salary-pay-schedule'

function parseUtcDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00.000Z`)
}

function formatIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
}

/**
 * Next salary pay date on or after `fromDate` (UTC calendar).
 * Semi-monthly: 15th and last day of month; monthly single: last day only.
 */
export function resolveNextPayableOn(
  paySchedule: SalaryPayScheduleMode | string | null | undefined,
  fromDateIso: string
): string {
  const mode = normalizeSalaryPaySchedule(paySchedule)
  const from = parseUtcDate(fromDateIso)
  let year = from.getUTCFullYear()
  let month = from.getUTCMonth() + 1
  const day = from.getUTCDate()

  const candidates: string[] = []

  if (mode === 'monthly_single') {
    const last = lastDayOfMonth(year, month)
    candidates.push(formatIso(new Date(Date.UTC(year, month - 1, last))))
  } else {
    candidates.push(formatIso(new Date(Date.UTC(year, month - 1, 15))))
    const last = lastDayOfMonth(year, month)
    candidates.push(formatIso(new Date(Date.UTC(year, month - 1, last))))
  }

  for (const c of candidates.sort()) {
    if (c >= fromDateIso.slice(0, 10)) return c
  }

  month += 1
  if (month > 12) {
    month = 1
    year += 1
  }

  if (mode === 'monthly_single') {
    const last = lastDayOfMonth(year, month)
    return formatIso(new Date(Date.UTC(year, month - 1, last)))
  }
  return formatIso(new Date(Date.UTC(year, month - 1, 15)))
}

/** Pay period bounds for a single installment date (for manual payroll lines). */
export function payPeriodForInstallmentDate(payableOnIso: string): { start: string; end: string } {
  const d = parseUtcDate(payableOnIso)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const last = lastDayOfMonth(year, month)

  if (day === 15) {
    return {
      start: formatIso(new Date(Date.UTC(year, month - 1, 1))),
      end: formatIso(new Date(Date.UTC(year, month - 1, 15))),
    }
  }
  if (day === last) {
    return {
      start: formatIso(new Date(Date.UTC(year, month - 1, 16))),
      end: formatIso(new Date(Date.UTC(year, month - 1, last))),
    }
  }
  return { start: payableOnIso, end: payableOnIso }
}
