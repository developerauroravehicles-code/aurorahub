import { createAdminClient } from '@/lib/supabase/admin'

/** Dealer portal users may stay logged in on up to this many devices/browsers at once. */
export const DEALER_MAX_CONCURRENT_SESSIONS = 3

/**
 * After login, keep only the N newest auth sessions for dealer-linked users (allows N concurrent logins).
 * Platform (HQ) users are not trimmed.
 */
export async function pruneDealerUserSessions(userId: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.rpc('prune_dealer_user_sessions', {
    p_user_id: userId,
    p_max_sessions: DEALER_MAX_CONCURRENT_SESSIONS,
  })
  if (error) {
    console.warn('prune_dealer_user_sessions:', error.message)
  }
}