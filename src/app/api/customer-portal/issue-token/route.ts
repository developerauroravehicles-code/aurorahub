import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildPortalUrl,
  generatePortalToken,
  getPortalTokenTtlDays,
  hashPortalToken,
  normalizePortalPhone,
  portalTokenExpiresAt,
} from '@/lib/customer-portal-token'

function isAuthorized(request: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) return false
  const authHeader = request.headers.get('authorization')
  const url = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  return (
    authHeader === `Bearer ${expectedSecret}` || querySecret === expectedSecret
  )
}

/**
 * Issue a customer portal magic link token for a phone number.
 * Protected by CRON_SECRET (Bearer or ?secret=).
 *
 * POST { "phone": "4161234567", "ttl_days": 30 }
 * → { "url", "token", "expires_at", "phone" }
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Set CRON_SECRET and pass Authorization: Bearer header.' },
      { status: 401 }
    )
  }

  let body: { phone?: string; ttl_days?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const phone = normalizePortalPhone(body.phone ?? '')
  if (!phone) {
    return NextResponse.json({ error: 'Valid 10-digit Canadian phone is required.' }, { status: 400 })
  }

  const ttlDays = body.ttl_days ?? getPortalTokenTtlDays()
  const token = generatePortalToken()
  const tokenHash = hashPortalToken(token)
  const expiresAt = portalTokenExpiresAt(ttlDays)

  const supabase = createAdminClient()
  const { error } = await supabase.from('customer_portal_access_tokens').insert({
    token_hash: tokenHash,
    customer_phone: phone,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error('issue-token insert failed', error.message)
    return NextResponse.json({ error: 'Could not issue portal token.' }, { status: 500 })
  }

  const url = buildPortalUrl(token)

  return NextResponse.json({
    url,
    token,
    expires_at: expiresAt.toISOString(),
    phone,
  })
}
