import { calculatePerCompletedAmount } from '@/app/dashboard/hr/payroll/payroll-utils'
import type { ResolvedPersonnelCompensation } from '@/lib/personnel-compensation'

export type { ResolvedPersonnelCompensation } from '@/lib/personnel-compensation'

export type SpecialistPayRates = {
  baseCompleted: number
  baseAmountCad: number
  perExtraCad: number
  removalCad: number
  transferCad: number
  delay30Usd: number
  delay60Usd: number
}

export const SPECIALIST_RATES: SpecialistPayRates = {
  baseCompleted: 15,
  baseAmountCad: 2000,
  perExtraCad: 50,
  removalCad: 30,
  transferCad: 80,
  delay30Usd: 20,
  delay60Usd: 30,
}

export type DelayFeeTier = 'none' | '30min' | '60min'

export type SpecialistPayLine = {
  id: string
  label: string
  amount: number
  currency: 'CAD' | 'USD'
  source:
    | 'installation'
    | 'removal'
    | 'transfer'
    | 'delay'
    | 'service_fee'
    | 'expense'
    | 'expense_claim'
    | 'manual'
    | 'base_salary'
}

export type SpecialistCompensationSnapshot = {
  profile_id: string
  period_start: string
  period_end: string
  installations_completed: number
  removals_completed: number
  transfers_completed: number
  delay_30min_count: number
  delay_60min_count: number
  service_jobs_completed: number
  rates_used: SpecialistPayRates
  pay_lines: SpecialistPayLine[]
  estimated_net_cad: number
  estimated_delay_usd: number
  manual_items: {
    id: string
    label: string
    amount: number
    notes: string
    created_at: string
  }[]
  /** HR-defined pay basis (personnel salary / payroll structure), when not default tier. */
  compensation_basis?: ResolvedPersonnelCompensation | null
}

export function computeSpecialistPayEstimate(input: {
  installationsCompleted: number
  removalsCompleted: number
  transfersCompleted: number
  delay30minCount: number
  delay60minCount: number
  serviceFeeTotal: number
  expenseReimbTotal: number
  expenseClaims: { id: string; label: string; amount: number }[]
  manualItems: { id: string; label: string; amount: number }[]
  rates?: SpecialistPayRates
  compensation?: ResolvedPersonnelCompensation | null
}): Pick<
  SpecialistCompensationSnapshot,
  'rates_used' | 'pay_lines' | 'estimated_net_cad' | 'estimated_delay_usd'
> {
  const rates = input.rates ?? SPECIALIST_RATES
  const comp = input.compensation
  const pay_lines: SpecialistPayLine[] = []

  const fixedPeriodPay = comp?.fixedPeriodPayCad ?? 0
  if (fixedPeriodPay > 0) {
    const annualNote =
      comp?.annualSalaryCad != null
        ? ` (annual $${comp.annualSalaryCad.toLocaleString()} CAD, prorated for period)`
        : ''
    pay_lines.push({
      id: 'base-salary',
      label: `${comp?.paymentTypeLabel ?? 'Base compensation'}${annualNote}`,
      amount: Math.round(fixedPeriodPay * 100) / 100,
      currency: 'CAD',
      source: 'base_salary',
    })
  }

  let installationNet = 0
  if (comp?.payMode === 'flat_per_installation' && comp.perInstallationCad != null) {
    installationNet = input.installationsCompleted * comp.perInstallationCad
    if (installationNet > 0) {
      pay_lines.push({
        id: 'installations',
        label: `Installations (${input.installationsCompleted} × $${comp.perInstallationCad.toLocaleString()} CAD)`,
        amount: Math.round(installationNet * 100) / 100,
        currency: 'CAD',
        source: 'installation',
      })
    }
  } else if (comp?.payMode !== 'fixed_period') {
    installationNet = calculatePerCompletedAmount(
      rates.baseCompleted,
      rates.baseAmountCad,
      rates.perExtraCad,
      input.installationsCompleted
    )

    if (installationNet > 0) {
      pay_lines.push({
        id: 'installations',
        label: `Installations (${input.installationsCompleted}) — first ${rates.baseCompleted} @ $${rates.baseAmountCad.toLocaleString()} CAD, then +$${rates.perExtraCad} CAD each`,
        amount: Math.round(installationNet * 100) / 100,
        currency: 'CAD',
        source: 'installation',
      })
    }
  }

  const removalNet = input.removalsCompleted * rates.removalCad
  if (removalNet > 0) {
    pay_lines.push({
      id: 'removals',
      label: `Removals (${input.removalsCompleted} × $${rates.removalCad} CAD)`,
      amount: removalNet,
      currency: 'CAD',
      source: 'removal',
    })
  }

  const transferNet = input.transfersCompleted * rates.transferCad
  if (transferNet > 0) {
    pay_lines.push({
      id: 'transfers',
      label: `Transfers (${input.transfersCompleted} × $${rates.transferCad} CAD)`,
      amount: transferNet,
      currency: 'CAD',
      source: 'transfer',
    })
  }

  const delay30Total = input.delay30minCount * rates.delay30Usd
  if (delay30Total > 0) {
    pay_lines.push({
      id: 'delay-30',
      label: `Delay 30 min (${input.delay30minCount} × $${rates.delay30Usd} USD)`,
      amount: delay30Total,
      currency: 'USD',
      source: 'delay',
    })
  }

  const delay60Total = input.delay60minCount * rates.delay60Usd
  if (delay60Total > 0) {
    pay_lines.push({
      id: 'delay-60',
      label: `Delay 1 hour (${input.delay60minCount} × $${rates.delay60Usd} USD)`,
      amount: delay60Total,
      currency: 'USD',
      source: 'delay',
    })
  }

  if (input.serviceFeeTotal > 0) {
    pay_lines.push({
      id: 'service-fees',
      label: 'Service completions ($20 CAD each)',
      amount: input.serviceFeeTotal,
      currency: 'CAD',
      source: 'service_fee',
    })
  }

  if (input.expenseReimbTotal > 0) {
    pay_lines.push({
      id: 'expense-reimb',
      label: 'Service job expense reimbursements',
      amount: input.expenseReimbTotal,
      currency: 'CAD',
      source: 'expense',
    })
  }

  for (const claim of input.expenseClaims) {
    pay_lines.push({
      id: claim.id,
      label: claim.label,
      amount: claim.amount,
      currency: 'CAD',
      source: 'expense_claim',
    })
  }

  for (const item of input.manualItems) {
    pay_lines.push({
      id: item.id,
      label: item.label,
      amount: item.amount,
      currency: 'CAD',
      source: 'manual',
    })
  }

  const estimated_net_cad =
    Math.round(
      pay_lines.filter((l) => l.currency === 'CAD').reduce((s, l) => s + l.amount, 0) * 100
    ) / 100

  const estimated_delay_usd =
    Math.round(
      pay_lines.filter((l) => l.currency === 'USD').reduce((s, l) => s + l.amount, 0) * 100
    ) / 100

  return { rates_used: rates, pay_lines, estimated_net_cad, estimated_delay_usd }
}

export function currentMonthPeriod(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export function formatRatesSummary(
  rates: SpecialistPayRates = SPECIALIST_RATES,
  compensation?: ResolvedPersonnelCompensation | null
): string {
  if (compensation?.payMode === 'flat_per_installation' && compensation.perInstallationCad != null) {
    return `$${compensation.perInstallationCad.toLocaleString()} CAD per installation · removal $${rates.removalCad} · transfer $${rates.transferCad} · delay $${rates.delay30Usd}/$${rates.delay60Usd} USD`
  }
  if (compensation?.payMode === 'fixed_period') {
    if (compensation.hourlyRateCad != null) {
      return `$${compensation.hourlyRateCad.toLocaleString()} CAD/hour (enter hours via HR payroll) · removal $${rates.removalCad} · transfer $${rates.transferCad}`
    }
    if (compensation.annualSalaryCad != null) {
      return `Annual salary $${compensation.annualSalaryCad.toLocaleString()} CAD · period estimate $${(compensation.fixedPeriodPayCad ?? 0).toLocaleString()} CAD`
    }
  }
  const r = rates
  return `${r.baseCompleted} dashcam @ $${r.baseAmountCad.toLocaleString()} CAD · +$${r.perExtraCad} CAD · removal $${r.removalCad} · transfer $${r.transferCad} · delay $${r.delay30Usd}/$${r.delay60Usd} USD`
}
