import {
  calculateDeductions,
  calculateGrossFromNet,
  calculatePerCompletedAmount,
} from '@/app/dashboard/hr/payroll/payroll-utils'

export type SpecialistPayLine = {
  id: string
  label: string
  amount: number
  source: 'installation' | 'service_fee' | 'expense' | 'manual'
}

export type SpecialistCompensationTier = {
  id: string
  base_completed: number
  base_amount: number
  per_completed_amount: number
  currency: string | null
  effective_from?: string
  effective_to?: string | null
}

export type SpecialistCompensationSnapshot = {
  profile_id: string
  personnel_id: string | null
  period_start: string
  period_end: string
  installations_completed: number
  service_jobs_completed: number
  tier: SpecialistCompensationTier | null
  installation_target_net: number
  pay_lines: SpecialistPayLine[]
  extras_gross: number
  base_gross: number
  effective_gross: number
  cpp: number
  ei: number
  federal_tax: number
  provincial_tax: number
  total_deductions: number
  estimated_net: number
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
  tier: SpecialistCompensationTier | null
  serviceFeeTotal: number
  expenseReimbTotal: number
  manualItems: { id: string; label: string; amount: number }[]
}): Pick<
  SpecialistCompensationSnapshot,
  | 'installation_target_net'
  | 'pay_lines'
  | 'extras_gross'
  | 'base_gross'
  | 'effective_gross'
  | 'cpp'
  | 'ei'
  | 'federal_tax'
  | 'provincial_tax'
  | 'total_deductions'
  | 'estimated_net'
> {
  const tier = input.tier
  const installationTargetNet = tier
    ? calculatePerCompletedAmount(
        Number(tier.base_completed),
        Number(tier.base_amount),
        Number(tier.per_completed_amount),
        input.installationsCompleted
      )
    : 0

  const pay_lines: SpecialistPayLine[] = []

  if (installationTargetNet > 0) {
    pay_lines.push({
      id: 'installations',
      label: `Installations (${input.installationsCompleted}) — net target before extras`,
      amount: installationTargetNet,
      source: 'installation',
    })
  }

  if (input.serviceFeeTotal > 0) {
    pay_lines.push({
      id: 'service-fees',
      label: 'Service completions ($20 each)',
      amount: input.serviceFeeTotal,
      source: 'service_fee',
    })
  }

  if (input.expenseReimbTotal > 0) {
    pay_lines.push({
      id: 'expense-reimb',
      label: 'Approved expense reimbursements',
      amount: input.expenseReimbTotal,
      source: 'expense',
    })
  }

  for (const item of input.manualItems) {
    pay_lines.push({
      id: item.id,
      label: item.label,
      amount: item.amount,
      source: 'manual',
    })
  }

  const baseGross = installationTargetNet > 0 ? calculateGrossFromNet(installationTargetNet) : 0
  const extrasGross =
    input.serviceFeeTotal +
    input.expenseReimbTotal +
    input.manualItems.reduce((s, m) => s + m.amount, 0)
  const effectiveGross = Math.round((baseGross + extrasGross) * 100) / 100
  const d = calculateDeductions(effectiveGross)

  return {
    installation_target_net: Math.round(installationTargetNet * 100) / 100,
    pay_lines,
    extras_gross: Math.round(extrasGross * 100) / 100,
    base_gross: Math.round(baseGross * 100) / 100,
    effective_gross: effectiveGross,
    cpp: Math.round(d.cpp * 100) / 100,
    ei: Math.round(d.ei * 100) / 100,
    federal_tax: Math.round(d.federalTax * 100) / 100,
    provincial_tax: Math.round(d.provincialTax * 100) / 100,
    total_deductions: Math.round(d.totalDeductions * 100) / 100,
    estimated_net: Math.round(d.net * 100) / 100,
  }
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
