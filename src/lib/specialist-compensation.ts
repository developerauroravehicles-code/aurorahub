import { calculatePerCompletedAmount } from '@/app/dashboard/hr/payroll/payroll-utils'

export const SPECIALIST_RATES = {
  baseCompleted: 15,
  baseAmountCad: 2000,
  perExtraCad: 50,
  removalCad: 30,
  transferCad: 80,
  delay30Usd: 20,
  delay60Usd: 30,
} as const

export type DelayFeeTier = 'none' | '30min' | '60min'

export type SpecialistPayLine = {
  id: string
  label: string
  amount: number
  currency: 'CAD' | 'USD'
  source: 'installation' | 'removal' | 'transfer' | 'delay' | 'service_fee' | 'expense' | 'expense_claim' | 'manual'
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
}): Pick<
  SpecialistCompensationSnapshot,
  'pay_lines' | 'estimated_net_cad' | 'estimated_delay_usd'
> {
  const pay_lines: SpecialistPayLine[] = []

  const installationNet = calculatePerCompletedAmount(
    SPECIALIST_RATES.baseCompleted,
    SPECIALIST_RATES.baseAmountCad,
    SPECIALIST_RATES.perExtraCad,
    input.installationsCompleted
  )

  if (installationNet > 0) {
    pay_lines.push({
      id: 'installations',
      label: `Installations (${input.installationsCompleted}) — first ${SPECIALIST_RATES.baseCompleted} @ $${SPECIALIST_RATES.baseAmountCad.toLocaleString()} CAD, then +$${SPECIALIST_RATES.perExtraCad} CAD each`,
      amount: Math.round(installationNet * 100) / 100,
      currency: 'CAD',
      source: 'installation',
    })
  }

  const removalNet = input.removalsCompleted * SPECIALIST_RATES.removalCad
  if (removalNet > 0) {
    pay_lines.push({
      id: 'removals',
      label: `Removals (${input.removalsCompleted} × $${SPECIALIST_RATES.removalCad} CAD)`,
      amount: removalNet,
      currency: 'CAD',
      source: 'removal',
    })
  }

  const transferNet = input.transfersCompleted * SPECIALIST_RATES.transferCad
  if (transferNet > 0) {
    pay_lines.push({
      id: 'transfers',
      label: `Transfers (${input.transfersCompleted} × $${SPECIALIST_RATES.transferCad} CAD)`,
      amount: transferNet,
      currency: 'CAD',
      source: 'transfer',
    })
  }

  const delay30Total = input.delay30minCount * SPECIALIST_RATES.delay30Usd
  if (delay30Total > 0) {
    pay_lines.push({
      id: 'delay-30',
      label: `Delay 30 min (${input.delay30minCount} × $${SPECIALIST_RATES.delay30Usd} USD)`,
      amount: delay30Total,
      currency: 'USD',
      source: 'delay',
    })
  }

  const delay60Total = input.delay60minCount * SPECIALIST_RATES.delay60Usd
  if (delay60Total > 0) {
    pay_lines.push({
      id: 'delay-60',
      label: `Delay 1 hour (${input.delay60minCount} × $${SPECIALIST_RATES.delay60Usd} USD)`,
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

  return { pay_lines, estimated_net_cad, estimated_delay_usd }
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

export function formatRatesSummary(): string {
  const r = SPECIALIST_RATES
  return `${r.baseCompleted} dashcam @ $${r.baseAmountCad.toLocaleString()} CAD · +$${r.perExtraCad} CAD · removal $${r.removalCad} · transfer $${r.transferCad} · delay $${r.delay30Usd}/$${r.delay60Usd} USD`
}
