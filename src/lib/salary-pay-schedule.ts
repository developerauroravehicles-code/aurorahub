export type SalaryPayScheduleMode = 'semi_monthly_equal' | 'monthly_single'

export type SalaryPayInstallment = {
  id: string
  installment: 1 | 2
  dueDate: string
  amount: number
  label: string
}

export const SALARY_PAY_SCHEDULE_LABELS: Record<SalaryPayScheduleMode, string> = {
  semi_monthly_equal: 'Semi-monthly (50% on 15th, 50% at month end)',
  monthly_single: 'Monthly (single payment)',
}

/** Monthly pay used for installment schedule (annual salary → ÷12). */
export function resolveMonthlySalaryAmount(
  salaryAmount: number | null | undefined,
  salaryType: string | null | undefined
): number | null {
  if (salaryAmount == null || !Number.isFinite(Number(salaryAmount)) || Number(salaryAmount) <= 0) {
    return null
  }
  const amount = Number(salaryAmount)
  const type = (salaryType ?? '').trim()
  if (type === 'salary' || type === '') {
    return Math.round((amount / 12) * 100) / 100
  }
  if (type === 'hourly' || type === 'per_installation' || type === 'commission') {
    return null
  }
  return Math.round(amount * 100) / 100
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
}

function splitHalf(monthlyAmount: number): { first: number; second: number } {
  const first = Math.round((monthlyAmount / 2) * 100) / 100
  const second = Math.round((monthlyAmount - first) * 100) / 100
  return { first, second }
}

/**
 * Two equal installments: pay date on the 15th and last calendar day of the month.
 */
export function buildSemiMonthlyInstallments(
  monthlyAmount: number,
  year: number,
  month1to12: number
): SalaryPayInstallment[] {
  if (monthlyAmount <= 0 || month1to12 < 1 || month1to12 > 12) return []
  const { first, second } = splitHalf(monthlyAmount)
  const mm = String(month1to12).padStart(2, '0')
  const lastDay = lastDayOfMonth(year, month1to12)
  const monthLabel = new Date(Date.UTC(year, month1to12 - 1, 1)).toLocaleString('en-CA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return [
    {
      id: `${year}-${mm}-mid`,
      installment: 1,
      dueDate: `${year}-${mm}-15`,
      amount: first,
      label: `${monthLabel} — 1st pay (15th)`,
    },
    {
      id: `${year}-${mm}-end`,
      installment: 2,
      dueDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
      amount: second,
      label: `${monthLabel} — 2nd pay (month end)`,
    },
  ]
}

export function buildMonthlySingleInstallment(
  monthlyAmount: number,
  year: number,
  month1to12: number
): SalaryPayInstallment[] {
  if (monthlyAmount <= 0 || month1to12 < 1 || month1to12 > 12) return []
  const mm = String(month1to12).padStart(2, '0')
  const lastDay = lastDayOfMonth(year, month1to12)
  const monthLabel = new Date(Date.UTC(year, month1to12 - 1, 1)).toLocaleString('en-CA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return [
    {
      id: `${year}-${mm}-month`,
      installment: 1,
      dueDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
      amount: Math.round(monthlyAmount * 100) / 100,
      label: `${monthLabel} — monthly pay`,
    },
  ]
}

export function buildSalaryPayInstallments(input: {
  salaryAmount: number | null | undefined
  salaryType: string | null | undefined
  paySchedule: SalaryPayScheduleMode | string | null | undefined
  year: number
  month1to12: number
}): SalaryPayInstallment[] {
  const monthly = resolveMonthlySalaryAmount(input.salaryAmount, input.salaryType)
  if (monthly == null) return []

  const mode = (input.paySchedule ?? 'semi_monthly_equal') as SalaryPayScheduleMode
  if (mode === 'monthly_single') {
    return buildMonthlySingleInstallment(monthly, input.year, input.month1to12)
  }
  return buildSemiMonthlyInstallments(monthly, input.year, input.month1to12)
}

export function normalizeSalaryPaySchedule(
  value: string | null | undefined
): SalaryPayScheduleMode {
  if (value === 'monthly_single') return 'monthly_single'
  return 'semi_monthly_equal'
}
