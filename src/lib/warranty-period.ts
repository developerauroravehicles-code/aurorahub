import { addYears } from 'date-fns'

export const MIN_WARRANTY_YEARS = 1
export const MAX_WARRANTY_YEARS = 5
export const DEFAULT_WARRANTY_YEARS = 3
export const AURORA_VEHICLES_HQ_WARRANTY_YEARS = 1
export const WARRANTY_YEAR_OPTIONS = [1, 2, 3, 4, 5] as const

/** Dealer display name for Aurora Vehicles HQ (1-year installation warranty). */
export const AURORA_VEHICLES_HQ_DEALER_NAME = 'Aurora Vehicles HQ'

export type WarrantyDealerInput =
  | string
  | null
  | undefined
  | {
      name?: string | null
      warrantyYears?: number | null
      warranty_years?: number | null
    }

export function isAuroraVehiclesHqDealer(dealerName: string | null | undefined): boolean {
  return (dealerName?.trim().toLowerCase() ?? '') === AURORA_VEHICLES_HQ_DEALER_NAME.toLowerCase()
}

export function clampWarrantyYears(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return DEFAULT_WARRANTY_YEARS
  return Math.min(MAX_WARRANTY_YEARS, Math.max(MIN_WARRANTY_YEARS, Math.round(value)))
}

export function parseWarrantyYearsFromForm(value: FormDataEntryValue | null): number {
  const parsed = parseInt(String(value ?? ''), 10)
  return clampWarrantyYears(Number.isNaN(parsed) ? DEFAULT_WARRANTY_YEARS : parsed)
}

export function resolveWarrantyYears(dealer: WarrantyDealerInput): number {
  if (dealer && typeof dealer === 'object') {
    const configured = dealer.warrantyYears ?? dealer.warranty_years
    if (configured != null) return clampWarrantyYears(configured)
  }

  const dealerName = typeof dealer === 'string' ? dealer : dealer?.name
  if (isAuroraVehiclesHqDealer(dealerName)) return AURORA_VEHICLES_HQ_WARRANTY_YEARS
  return DEFAULT_WARRANTY_YEARS
}

/** @deprecated Prefer resolveWarrantyYears with dealer context. */
export function warrantyYearsForDealer(dealer: WarrantyDealerInput): number {
  return resolveWarrantyYears(dealer)
}

export function warrantyEndFromCompletion(
  completionDate: Date,
  dealer?: WarrantyDealerInput
): Date {
  return addYears(completionDate, resolveWarrantyYears(dealer))
}

export function warrantyPeriodDescription(dealer?: WarrantyDealerInput): string {
  const years = resolveWarrantyYears(dealer ?? null)
  return years === 1 ? 'one year' : `${years} years`
}

export function warrantyBadgeLabel(dealer?: WarrantyDealerInput): string {
  const years = resolveWarrantyYears(dealer ?? null)
  return `${years}Y`
}
