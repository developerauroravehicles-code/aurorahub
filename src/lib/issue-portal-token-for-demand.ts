import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildPortalUrl,
  generatePortalToken,
  getPortalTokenTtlDays,
  hashPortalToken,
  normalizePortalPhone,
  portalTokenExpiresAt,
} from '@/lib/customer-portal-token'

/** Magic link tied to a specific demand (dealer handoff flow). */
export async function issuePortalTokenForDemand(
  phone: string,
  demandId: string,
  createdByProfileId?: string | null
): Promise<{ url: string; expires_at: string } | null> {
  const normalized = normalizePortalPhone(phone)
  if (!normalized) return null

  const token = generatePortalToken()
  const expiresAt = portalTokenExpiresAt(getPortalTokenTtlDays())
  const admin = createAdminClient()

  const { error } = await admin.from('customer_portal_access_tokens').insert({
    token_hash: hashPortalToken(token),
    customer_phone: normalized,
    demand_id: demandId,
    expires_at: expiresAt.toISOString(),
    created_by: createdByProfileId ?? null,
  })

  if (error) {
    console.error('issuePortalTokenForDemand failed', error.message)
    return null
  }

  return { url: buildPortalUrl(token), expires_at: expiresAt.toISOString() }
}