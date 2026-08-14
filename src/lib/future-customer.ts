/** Detect placeholder "Future Customer" records that should not receive SMS until updated. */

export interface FutureCustomerFields {
  customer_phone?: string | null
  customer_firstname?: string | null
  customer_lastname?: string | null
}

export function phoneKeyDigits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '')
}

export function isFutureCustomer(fields: FutureCustomerFields): boolean {
  const key = phoneKeyDigits(fields.customer_phone)
  if (key === '0000000000') return true
  const first = (fields.customer_firstname ?? '').trim().toLowerCase()
  const last = (fields.customer_lastname ?? '').trim().toLowerCase()
  return first === 'future' && last === 'customer'
}
