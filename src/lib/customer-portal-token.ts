import { createHash, randomBytes } from 'crypto'

const DEFAULT_TTL_DAYS = 30

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

export function buildPortalUrl(token: string, baseUrl?: string): string {
  const origin =
    baseUrl?.replace(/\/$/, '') ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
  return `${origin}/customer-portal?token=${encodeURIComponent(token)}`
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
