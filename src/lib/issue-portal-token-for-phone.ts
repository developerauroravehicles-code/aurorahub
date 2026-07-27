import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildPortalUrl,
  generatePortalToken,
  getPortalTokenTtlDays,
  hashPortalToken,
  normalizePortalPhone,
  portalTokenExpiresAt,
} from '@/lib/customer-portal-token'

/** Issue a portal magic link for a customer phone (used on demand completion webhooks). */
export async function issuePortalTokenForPhone(
  phone: string
): Promise<{ url: string; expires_at: string } | null> {
  const normalized = normalizePortalPhone(phone)
  if (!normalized) return null

  const token = generatePortalToken()
  const expiresAt = portalTokenExpiresAt(getPortalTokenTtlDays())
  const admin = createAdminClient()

  const { error } = await admin.from('customer_portal_access_tokens').insert({
    token_hash: hashPortalToken(token),
    customer_phone: normalized,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error('issuePortalTokenForPhone failed', error.message)
    return null
  }

  return { url: buildPortalUrl(token), expires_at: expiresAt.toISOString() }
}
