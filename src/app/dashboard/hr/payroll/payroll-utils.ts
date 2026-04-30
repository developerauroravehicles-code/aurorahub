// Pure calculation utils - not Server Actions (can be used client & server)

export function calculatePerCompletedAmount(
  baseCompleted: number,
  baseAmount: number,
  perCompletedAmount: number,
  completedCount: number
): number {
  if (completedCount <= 0) return 0
  if (completedCount <= baseCompleted) return baseAmount
  return baseAmount + (completedCount - baseCompleted) * perCompletedAmount
}

/** @deprecated use calculatePerCompletedAmount */
export const calculatePerCompletedGross = calculatePerCompletedAmount

// Canadian payroll deduction constants (bi-weekly)
const CPP_RATE = 0.0595
const CPP_EXEMPTION_ANNUAL = 3500
const EI_RATE = 0.0166
const EI_MAX_ANNUAL = 1049

export function calculateDeductions(gross: number, payPeriodsPerYear: number = 26): {
  cpp: number
  ei: number
  federalTax: number
  provincialTax: number
  totalDeductions: number
  net: number
} {
  const cppExemptionPerPeriod = CPP_EXEMPTION_ANNUAL / payPeriodsPerYear
  const taxableCpp = Math.max(0, gross - cppExemptionPerPeriod)
  const cppAnnualMax = 3867
  const cpp = Math.min(taxableCpp * CPP_RATE, cppAnnualMax / payPeriodsPerYear)
  const ei = Math.min(gross * EI_RATE, EI_MAX_ANNUAL / payPeriodsPerYear)
  const federalBasicPersonal = 15000 / payPeriodsPerYear
  /** BC basic personal amount (annual), representative 2024–2025 figure; per-period share. */
  const provincialBasicPersonal = 12705 / payPeriodsPerYear
  const taxableFederal = Math.max(0, gross - federalBasicPersonal)
  const taxableProvincial = Math.max(0, gross - provincialBasicPersonal)
  const federalTax = taxableFederal * 0.15
  /** BC lowest provincial bracket rate (simplified estimator; mirrors prior ON single-rate approach). */
  const provincialTax = taxableProvincial * 0.0506
  const totalDeductions = cpp + ei + federalTax + provincialTax
  const net = Math.max(0, gross - totalDeductions)
  return { cpp, ei, federalTax, provincialTax, totalDeductions, net }
}

export type ExtraEarningLine = { id: string; label: string; amount: number }

/**
 * Effective gross (base gross + extra earnings), then net after payroll deductions shown on stub.
 */
export function computeEffectiveGrossAndNet(
  baseGross: number,
  extraEarnings: ExtraEarningLine[],
  cpp: number,
  ei: number,
  federalTax: number,
  provincialTax: number
): { effectiveGross: number; net: number } {
  const extrasSum = extraEarnings.reduce((s, e) => s + Math.max(0, Number(e.amount) || 0), 0)
  const effectiveGross = Math.round((Math.max(0, baseGross) + extrasSum) * 100) / 100
  const totalTaxes = cpp + ei + federalTax + provincialTax
  const net = Math.round((effectiveGross - totalTaxes) * 100) / 100
  return { effectiveGross, net }
}

/** Calculate Gross from target Net (after CPP, EI, taxes) */
export function calculateGrossFromNet(targetNet: number, payPeriodsPerYear: number = 26): number {
  if (targetNet <= 0) return 0
  let gross = targetNet * 1.25 // initial guess: net ~80%
  for (let i = 0; i < 30; i++) {
    const d = calculateDeductions(gross, payPeriodsPerYear)
    const diff = targetNet - d.net
    if (Math.abs(diff) < 0.01) return Math.round(gross * 100) / 100
    gross = gross + diff
  }
  return Math.round(gross * 100) / 100
}
