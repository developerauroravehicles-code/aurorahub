/** Placeholder customer name until the customer completes details via portal link. */
export const DEALER_HANDOFF_PLACEHOLDER_FIRST = 'PENDING'
export const DEALER_HANDOFF_PLACEHOLDER_LAST = 'CUSTOMER'

export function isDealerHandoffPlaceholderName(first: string, last: string): boolean {
  return (
    first.trim().toUpperCase() === DEALER_HANDOFF_PLACEHOLDER_FIRST &&
    last.trim().toUpperCase() === DEALER_HANDOFF_PLACEHOLDER_LAST
  )
}