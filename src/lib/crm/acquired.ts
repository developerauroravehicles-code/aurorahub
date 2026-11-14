export function canSetDealerAcquired(existingAcquiredBy: string | null | undefined): boolean {
  return existingAcquiredBy == null
}