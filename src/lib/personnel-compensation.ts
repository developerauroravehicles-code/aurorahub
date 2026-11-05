import type { SpecialistPayRates } from '@/lib/specialist-compensation'
import { SPECIALIST_RATES } from '@/lib/specialist-compensation'

export type CompensationPayMode = 'tiered' | 'flat_per_installation' | 'fixed_period'

export type ResolvedPersonnelCompensation = {
  payMode: CompensationPayMode
  rates: SpecialistPayRates
  perInstallationCad?: number
  fixedPeriodPayCad?: number
  hourlyRateCad?: number
  annualSalaryCad?: number
  paymentTypeLabel?: string
}

function parseUtcDate(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  return new Date(`${isoDate}T00:00:00.000Z`)
}

function daysInYearUtc(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365
}

/** Prorate annual salary across [periodStart, periodEnd] inclusive (UTC dates). */
export function prorateAnnualSalaryToPeriod(
  annualAmount: number,
  periodStart: string,
  periodEnd: string
): number {
  const start = parseUtcDate(periodStart)
  const end = parseUtcDate(periodEnd)
  if (!start || !end || end < start || !Number.isFinite(annualAmount) || annualAmount <= 0) {
    return 0
  }
  const msPerDay = 86400000
  const daysInPeriod = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1
  const daysInYear = daysInYearUtc(start.getUTCFullYear())
  return Math.round(((annualAmount * daysInPeriod) / daysInYear) * 100) / 100
}

export function mapSalaryFieldsToCompensation(
  amount: number,
  salaryType: string | null | undefined,
  periodStart: string,
  periodEnd: string,
  baseRates: SpecialistPayRates = SPECIALIST_RATES
): ResolvedPersonnelCompensation | null {
  if (!Number.isFinite(amount) || amount <= 0) return null

  const type = (salaryType ?? '').trim()

  if (type === 'per_installation') {
    return {
      payMode: 'flat_per_installation',
      rates: baseRates,
      perInstallationCad: amount,
      paymentTypeLabel: 'Per installation',
    }
  }

  if (type === 'salary' || type === '') {
    return {
      payMode: 'fixed_period',
      rates: baseRates,
      fixedPeriodPayCad: prorateAnnualSalaryToPeriod(amount, periodStart, periodEnd),
      annualSalaryCad: amount,
      paymentTypeLabel: type === 'salary' ? 'Annual salary' : 'Compensation',
    }
  }

  if (type === 'hourly') {
    return {
      payMode: 'fixed_period',
      rates: baseRates,
      hourlyRateCad: amount,
      fixedPeriodPayCad: 0,
      paymentTypeLabel: 'Hourly',
    }
  }

  if (type === 'commission') {
    return {
      payMode: 'tiered',
      rates: baseRates,
      paymentTypeLabel: 'Commission (job-based)',
    }
  }

  return {
    payMode: 'fixed_period',
    rates: baseRates,
    fixedPeriodPayCad: prorateAnnualSalaryToPeriod(amount, periodStart, periodEnd),
    annualSalaryCad: amount,
    paymentTypeLabel: type,
  }
}

export function mapPaymentTypeToCompensation(
  paymentType: string,
  amount: number | null | undefined,
  periodStart: string,
  periodEnd: string,
  baseRates: SpecialistPayRates = SPECIALIST_RATES
): ResolvedPersonnelCompensation | null {
  if (amount == null || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return null
  const amt = Number(amount)

  if (paymentType === 'per_completed_tiered') {
    return null
  }
  if (paymentType === 'per_installation') {
    return mapSalaryFieldsToCompensation(amt, 'per_installation', periodStart, periodEnd, baseRates)
  }
  if (paymentType === 'hourly') {
    return mapSalaryFieldsToCompensation(amt, 'hourly', periodStart, periodEnd, baseRates)
  }
  if (paymentType === 'salary') {
    return mapSalaryFieldsToCompensation(amt, 'salary', periodStart, periodEnd, baseRates)
  }
  return mapSalaryFieldsToCompensation(amt, paymentType, periodStart, periodEnd, baseRates)
}
