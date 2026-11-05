import { resolveMonthlySalaryAmount } from '@/lib/salary-pay-schedule'

export const STANDARD_MONTHLY_HOURS = 173.33
export const EXTRA_DUTY_MULTIPLIER = 1.5

export function computeBaseHourlyFromMonthly(monthlyAmount: number): number {
  if (monthlyAmount <= 0) return 0
  return monthlyAmount / STANDARD_MONTHLY_HOURS
}

export function computeExtraDutyHourlyRate(
  salaryAmount: number | null | undefined,
  salaryType: string | null | undefined
): { hourlyRate: number; monthlyAmount: number } | { error: string } {
  const monthly = resolveMonthlySalaryAmount(salaryAmount, salaryType)
  if (monthly == null || monthly <= 0) {
    return {
      error:
        'Extra Duty requires an annual salary on your HR record (Salary type). Contact HR if your pay is not set up.',
    }
  }
  const baseHourly = computeBaseHourlyFromMonthly(monthly)
  const hourlyRate = Math.round(baseHourly * EXTRA_DUTY_MULTIPLIER * 10000) / 10000
  return { hourlyRate, monthlyAmount: monthly }
}

export function parseDurationFromForm(hoursRaw: string, minutesRaw: string): number | { error: string } {
  const hours = parseInt(String(hoursRaw ?? '0'), 10)
  const minutes = parseInt(String(minutesRaw ?? '0'), 10)
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    return { error: 'Enter valid hours (0–24).' }
  }
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return { error: 'Enter valid minutes (0–59).' }
  }
  const total = hours * 60 + minutes
  if (total <= 0) return { error: 'Enter at least 1 minute of Extra Duty time.' }
  if (total > 24 * 60) return { error: 'Extra Duty cannot exceed 24 hours per entry.' }
  return total
}

export function formatDurationMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function computeExtraDutyAmount(input: {
  salaryAmount: number | null | undefined
  salaryType: string | null | undefined
  durationMinutes: number
}): { amount: number; hourlyRateUsed: number; durationMinutes: number } | { error: string } {
  const rateResult = computeExtraDutyHourlyRate(input.salaryAmount, input.salaryType)
  if ('error' in rateResult) return rateResult

  const hours = input.durationMinutes / 60
  const amount = Math.round(rateResult.hourlyRate * hours * 100) / 100
  if (amount <= 0) return { error: 'Calculated amount is zero. Check duration and HR salary.' }

  return {
    amount,
    hourlyRateUsed: rateResult.hourlyRate,
    durationMinutes: input.durationMinutes,
  }
}
