import { createHash, randomBytes } from 'crypto'

const DEFAULT_TTL_DAYS = 30
const PRODUCTION_PORTAL_ORIGIN = 'https://aurorahub.ca'

export function hashPortalToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex')
}

export function generatePortalToken(): string {
  return randomBytes(32).toString('base64url')
}

export function portalTokenExpiresAt(ttlDays = DEFAULT_TTL_DAYS): Date {
  const days = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : DEFAULT_TTL_DAYS
  const expires = new Date()
  expires.setUTCDate(expires.getUTCDate() + days)
  return expires
}

/**
 * Public origin for customer-facing portal links (SMS, webhooks).
 * Never uses VERCEL_URL — preview deployments require Vercel login.
 */
export function getPortalPublicOrigin(): string {
  const explicit =
    process.env.CUSTOMER_PORTAL_PUBLIC_URL?.replace(/\/$/, '') ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')

  if (explicit) {
    // Ignore Vercel preview URLs even if set in env by mistake
    if (!explicit.includes('.vercel.app')) return explicit
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000'
  }

  return PRODUCTION_PORTAL_ORIGIN
}

/** Customer magic link: https://aurorahub.ca/customer-portal/{token} */
export function buildPortalUrl(token: string, baseUrl?: string): string {
  const origin = baseUrl?.replace(/\/$/, '') ?? getPortalPublicOrigin()
  const safeToken = encodeURIComponent(token.trim())
  return `${origin}/customer-portal/${safeToken}`
}

/** Legacy query-string links still supported for backward compatibility. */
export function buildPortalUrlLegacy(token: string, baseUrl?: string): string {
  const origin = baseUrl?.replace(/\/$/, '') ?? getPortalPublicOrigin()
  return `${origin}/customer-portal?token=${encodeURIComponent(token.trim())}`
}

export function normalizePortalPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  return digits.length === 10 ? digits : null
}

export function getPortalTokenTtlDays(): number {
  const raw = process.env.CUSTOMER_PORTAL_TOKEN_TTL_DAYS
  const parsed = raw ? parseInt(raw, 10) : DEFAULT_TTL_DAYS
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_DAYS
}

/** Extract token from path segment or ?token= query (legacy). */
export function extractPortalTokenFromPath(pathname: string): string | null {
  const trimmed = pathname.replace(/\/+$/, '')
  const prefix = '/customer-portal/'
  if (!trimmed.startsWith(prefix)) return null
  const segment = trimmed.slice(prefix.length).split('/')[0]?.trim()
  if (!segment || segment === 'customer-portal') return null
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
