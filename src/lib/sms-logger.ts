import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SmsMessageType =
  | 'appointment_created'
  | 'cancellation_notice'
  | 'rescheduling_notice'
  | 'four_hour_reminder'
  | 'twenty_four_hour_reminder'
  | 'customer_directory_manual'
  | 'service_appointment_scheduled'
  | 'service_record_pending'
  | 'daily_invoice_missed'
  | 'post_completion_portal'
  | 'post_completion_custom'
  | 'sd_card_warranty_expired'
  | 'dashcam_warranty_expired'

export type SmsDeliveryStatus = 'sent' | 'failed'

export interface LogSmsParams {
  phoneNumber: string
  recipientType: 'customer' | 'specialist' | 'aurora_manager'
  recipientName?: string
  demandId?: string
  messageType: SmsMessageType
  triggeredBy: 'system' | 'manual'
  messageContent?: string
  deliveryStatus?: SmsDeliveryStatus
  errorMessage?: string
  twilioSid?: string
}

function isSchemaMismatchError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('delivery_status') ||
    m.includes('error_message') ||
    m.includes('twilio_sid') ||
    m.includes('message_type_check') ||
    m.includes('does not exist')
  )
}

/**
 * Persist SMS attempt to sms_logs. Uses service role by default so inserts
 * succeed regardless of caller RLS. Retries with legacy columns if migration not applied.
 */
export async function logSmsAttempt(params: LogSmsParams, supabaseClient?: SupabaseClient): Promise<void> {
  try {
    const supabase = supabaseClient ?? createAdminClient()
    const fullRow = {
      phone_number: params.phoneNumber,
      recipient_type: params.recipientType,
      recipient_name: params.recipientName ?? null,
      demand_id: params.demandId ?? null,
      message_type: params.messageType,
      triggered_by: params.triggeredBy,
      message_content: params.messageContent ?? null,
      delivery_status: params.deliveryStatus ?? 'sent',
      error_message: params.errorMessage ?? null,
      twilio_sid: params.twilioSid ?? null,
    }

    const { error } = await supabase.from('sms_logs').insert(fullRow)
    if (!error) return

    if (isSchemaMismatchError(error.message)) {
      const { error: legacyError } = await supabase.from('sms_logs').insert({
        phone_number: params.phoneNumber,
        recipient_type: params.recipientType,
        recipient_name: params.recipientName ?? null,
        demand_id: params.demandId ?? null,
        message_type: params.messageType,
        triggered_by: params.triggeredBy,
        message_content: params.messageContent ?? null,
      })
      if (legacyError) {
        console.error('Failed to log SMS (legacy fallback):', legacyError.message, params.messageType)
      }
      return
    }

    console.error('Failed to log SMS to sms_logs:', error.message, params.messageType, params.phoneNumber)
  } catch (err) {
    console.error('Failed to log SMS:', err)
  }
}

/** @deprecated Use logSmsAttempt */
export async function logSmsSent(params: LogSmsParams, supabaseClient?: SupabaseClient): Promise<void> {
  return logSmsAttempt({ ...params, deliveryStatus: params.deliveryStatus ?? 'sent' }, supabaseClient)
}

export function twilioErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }
  if (error != null) return String(error)
  return 'Send failed'
}

const SMS_LOGS_BASE_SELECT =
  'id, sent_at, phone_number, recipient_type, recipient_name, demand_id, message_type, triggered_by, message_content'

const SMS_LOGS_EXTENDED_SELECT = `${SMS_LOGS_BASE_SELECT}, delivery_status, error_message`

/** Query sms_logs; falls back to legacy columns when delivery_status migration is missing. */
export async function querySmsLogs(
  supabase: SupabaseClient,
  filters?: { dateFrom?: string; dateTo?: string; customerName?: string }
): Promise<{ data: Record<string, unknown>[] | null; error: string | null; schemaWarning?: string }> {
  const runQuery = (select: string) => {
    let query = supabase.from('sms_logs').select(select).order('sent_at', { ascending: false }).limit(200)
    if (filters?.dateFrom) query = query.gte('sent_at', `${filters.dateFrom}T00:00:00.000Z`)
    if (filters?.dateTo) query = query.lte('sent_at', `${filters.dateTo}T23:59:59.999Z`)
    if (filters?.customerName?.trim()) {
      query = query.ilike('recipient_name', `%${filters.customerName.trim()}%`)
    }
    return query
  }

  const extended = await runQuery(SMS_LOGS_EXTENDED_SELECT)
  if (!extended.error) {
    return { data: (extended.data ?? []) as unknown as Record<string, unknown>[], error: null }
  }

  if (isSchemaMismatchError(extended.error.message)) {
    const legacy = await runQuery(SMS_LOGS_BASE_SELECT)
    if (legacy.error) return { data: null, error: legacy.error.message }
    const rows = ((legacy.data ?? []) as unknown[]).map((row) => {
      const base = row as Record<string, unknown>
      return {
        ...base,
        delivery_status: 'sent',
        error_message: null,
      }
    })
    return {
      data: rows,
      error: null,
      schemaWarning: 'SMS delivery status migration not applied; run 20260815120000_sms_lifecycle_delivery_status.sql',
    }
  }

  return { data: null, error: extended.error.message }
}
