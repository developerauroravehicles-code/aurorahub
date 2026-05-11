/** URL-safe Base64 without relying on Buffer's optional `base64url` codec (unsupported in some runtimes). */
function encodeUtf8Base64Url(utf8Input: string): string {
  return Buffer.from(utf8Input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '')
}

/** Decode padded or unpadded base64url to UTF-8 string. */
function decodeUtf8Base64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4))
  return Buffer.from(base64 + pad, 'base64').toString('utf8')
}

/** URL-safe key for customer routes (digits-only phone_key → base64url, no raw phone in path). */

export function phoneKeyToCustomerRouteKey(phoneKey: string): string {
  return encodeUtf8Base64Url(phoneKey)
}

export function customerRouteKeyToPhoneKey(routeKey: string): string | null {
  try {
    const decoded = decodeUtf8Base64Url(routeKey)
    if (!decoded || !/^\d+$/.test(decoded)) return null
    return decoded
  } catch {
    return null
  }
}
