'use server'

import { createClient } from '@/lib/supabase/server'

export type IdentityEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_reset'
  | 'role_change'

interface LogIdentityEventParams {
  eventType: IdentityEventType
  userId?: string | null
  email?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown>
}

export async function logIdentityEvent(params: LogIdentityEventParams) {
  try {
    const supabase = await createClient()
    await supabase.from('identity_audit_log').insert({
      event_type: params.eventType,
      user_id: params.userId ?? null,
      email: params.email ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      metadata: params.metadata ?? null,
    })
  } catch {
    // Non-blocking: audit failure should not break auth flow
  }
}
