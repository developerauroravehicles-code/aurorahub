import { createHash, randomBytes } from 'crypto'

const PRODUCTION_APP_ORIGIN = 'https://aurorahub.ca'

export function generatePasswordChangeToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashPasswordChangeToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex')
}

export function getPasswordChangePublicOrigin(): string {
  const explicit =
    process.env.PASSWORD_CHANGE_PUBLIC_URL?.replace(/\/$/, '') ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')

  if (explicit && !isLocalOrPreviewOrigin(explicit)) {
    return explicit
  }

  return PRODUCTION_APP_ORIGIN
}

function isLocalOrPreviewOrigin(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('.vercel.app')
  )
}

export function buildChangePasswordUrl(rawToken: string, baseUrl?: string): string {
  const origin = baseUrl?.replace(/\/$/, '') ?? getPasswordChangePublicOrigin()
  return `${origin}/auth/change-password?token=${encodeURIComponent(rawToken.trim())}`
}

export function tokenExpiresAt(hours: number): Date {
  const expires = new Date()
  expires.setTime(expires.getTime() + hours * 60 * 60 * 1000)
  return expires
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  if (local.length <= 2) return `**@${domain}`
  return `${local.slice(0, 2)}***@${domain}`
}
