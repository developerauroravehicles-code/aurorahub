import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Insert a sms_pending comm_notification for all aurora_manager users.
 * Call fire-and-forget (.catch(() => {})) after a failed or skipped SMS send.
 *
 * @param supabase  Admin client (bypasses RLS)
 * @param demandId  The demand the SMS was for
 * @param messageType  Which SMS template was expected but not sent
 * @param reason  Short human-readable reason (e.g. 'Send failed', 'Disabled in settings')
 */
export async function notifyAuroraManagersSmsFailed(
  supabase: SupabaseClient,
  demandId: string,
  messageType: string,
  reason: string
): Promise<void> {
  const { data: managers } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'aurora_manager')

  if (!managers?.length) return

  await supabase.from('comm_notifications').insert(
    managers.map((m: { id: string }) => ({
      user_id: m.id,
      type: 'sms_pending' as const,
      payload: {
        demandId,
        messageType,
        reason,
        failedAt: new Date().toISOString(),
      },
    }))
  )
}
