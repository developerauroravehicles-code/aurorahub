/** URL-safe key for customer routes (digits-only phone_key → base64url, no raw phone in path). */

export function phoneKeyToCustomerRouteKey(phoneKey: string): string {
  return Buffer.from(phoneKey, 'utf8').toString('base64url')
}

export function customerRouteKeyToPhoneKey(routeKey: string): string | null {
  try {
    const decoded = Buffer.from(routeKey, 'base64url').toString('utf8')
    if (!decoded || !/^\d+$/.test(decoded)) return null
    return decoded
  } catch {
    return null
  }
}
