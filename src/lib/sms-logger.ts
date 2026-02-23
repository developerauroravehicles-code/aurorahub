import { createClient } from '@/lib/supabase/server'

export type SmsMessageType = 'appointment_created' | 'cancellation_notice' | 'rescheduling_notice' | 'four_hour_reminder'

export interface LogSmsParams {
  phoneNumber: string
  recipientType: 'customer' | 'specialist'
  recipientName?: string
  demandId?: string
  messageType: SmsMessageType
  triggeredBy: 'system' | 'manual'
}

export async function logSmsSent(params: LogSmsParams): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('sms_logs').insert({
      phone_number: params.phoneNumber,
      recipient_type: params.recipientType,
      recipient_name: params.recipientName ?? null,
      demand_id: params.demandId ?? null,
      message_type: params.messageType,
      triggered_by: params.triggeredBy,
    })
  } catch (err) {
    console.error('Failed to log SMS:', err)
  }
}
