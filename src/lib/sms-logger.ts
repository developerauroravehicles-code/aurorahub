import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SmsMessageType = 'appointment_created' | 'cancellation_notice' | 'rescheduling_notice' | 'four_hour_reminder' | 'twenty_four_hour_reminder'

export interface LogSmsParams {
  phoneNumber: string
  recipientType: 'customer' | 'specialist' | 'aurora_manager'
  recipientName?: string
  demandId?: string
  messageType: SmsMessageType
  triggeredBy: 'system' | 'manual'
  messageContent?: string
}

/**
 * Persist SMS to sms_logs. Uses service role by default (same as mail_logs) so inserts
 * succeed regardless of caller RLS; user-session client was causing silent failures for
 * finance/specialist flows.
 */
export async function logSmsSent(params: LogSmsParams, supabaseClient?: SupabaseClient): Promise<void> {
  try {
    const supabase = supabaseClient ?? createAdminClient()
    const { error } = await supabase.from('sms_logs').insert({
      phone_number: params.phoneNumber,
      recipient_type: params.recipientType,
      recipient_name: params.recipientName ?? null,
      demand_id: params.demandId ?? null,
      message_type: params.messageType,
      triggered_by: params.triggeredBy,
      message_content: params.messageContent ?? null,
    })
    if (error) {
      console.error('Failed to log SMS to sms_logs:', error.message, params.messageType, params.phoneNumber)
    }
  } catch (err) {
    console.error('Failed to log SMS:', err)
  }
}
