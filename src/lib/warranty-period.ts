import { addYears } from 'date-fns'

export const DEFAULT_WARRANTY_YEARS = 3
export const AURORA_VEHICLES_HQ_WARRANTY_YEARS = 1

/** Dealer display name for Aurora Vehicles HQ (1-year installation warranty). */
export const AURORA_VEHICLES_HQ_DEALER_NAME = 'Aurora Vehicles HQ'

export function isAuroraVehiclesHqDealer(dealerName: string | null | undefined): boolean {
  return (dealerName?.trim().toLowerCase() ?? '') === AURORA_VEHICLES_HQ_DEALER_NAME.toLowerCase()
}

export function warrantyYearsForDealer(dealerName: string | null | undefined): number {
  return isAuroraVehiclesHqDealer(dealerName) ? AURORA_VEHICLES_HQ_WARRANTY_YEARS : DEFAULT_WARRANTY_YEARS
}

export function warrantyEndFromCompletion(
  completionDate: Date,
  dealerName?: string | null
): Date {
  return addYears(completionDate, warrantyYearsForDealer(dealerName))
}

export function warrantyPeriodDescription(dealerName?: string | null): string {
  const years = warrantyYearsForDealer(dealerName)
  return years === 1 ? 'one year' : 'three years'
}

export function warrantyBadgeLabel(dealerName?: string | null): string {
  const years = warrantyYearsForDealer(dealerName)
  return `${years}Y`
}
