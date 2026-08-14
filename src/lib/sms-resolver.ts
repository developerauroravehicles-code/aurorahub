import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone } from './timezone-defaults'
import type { SMSSettings } from './sms-settings'
import { DEFAULT_SMS_SETTINGS } from './sms-settings'

function mergeTrigger<T extends object>(defaults: T, parsed?: Partial<T>): T {
  return { ...defaults, ...parsed }
}

export async function getSmsSettings(supabaseClient?: SupabaseClient): Promise<SMSSettings> {
  const supabase = supabaseClient ?? (await createClient())
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'sms_settings')
    .single()
  if (!data?.value) return DEFAULT_SMS_SETTINGS
  try {
    const parsed = JSON.parse(data.value) as Partial<SMSSettings>
    return {
      ...DEFAULT_SMS_SETTINGS,
      ...parsed,
      appointment_created: mergeTrigger(DEFAULT_SMS_SETTINGS.appointment_created, parsed.appointment_created),
      cancellation_notice: mergeTrigger(DEFAULT_SMS_SETTINGS.cancellation_notice, parsed.cancellation_notice),
      rescheduling_notice: mergeTrigger(DEFAULT_SMS_SETTINGS.rescheduling_notice, parsed.rescheduling_notice),
      four_hour_reminder: mergeTrigger(DEFAULT_SMS_SETTINGS.four_hour_reminder, parsed.four_hour_reminder),
      twenty_four_hour_reminder: mergeTrigger(
        DEFAULT_SMS_SETTINGS.twenty_four_hour_reminder,
        parsed.twenty_four_hour_reminder
      ),
      post_completion_portal: mergeTrigger(
        DEFAULT_SMS_SETTINGS.post_completion_portal,
        parsed.post_completion_portal
      ),
      post_completion_custom: mergeTrigger(
        DEFAULT_SMS_SETTINGS.post_completion_custom,
        parsed.post_completion_custom
      ),
      sd_card_warranty_expired: mergeTrigger(
        DEFAULT_SMS_SETTINGS.sd_card_warranty_expired,
        parsed.sd_card_warranty_expired
      ),
      dashcam_warranty_expired: mergeTrigger(
        DEFAULT_SMS_SETTINGS.dashcam_warranty_expired,
        parsed.dashcam_warranty_expired
      ),
    }
  } catch {
    return DEFAULT_SMS_SETTINGS
  }
}

/** Resolve template variables for appointment_created */
export function resolveAppointmentCreatedTemplate(
  template: string,
  opts: { appointmentDate: Date; address: string; timezoneName?: string; signature: string }
): string {
  const tz = getEffectiveTimezone(opts.timezoneName ?? null)
  const dateStr = formatInTimeZone(opts.appointmentDate, tz, "MMMM dd, yyyy 'at' h:mm a")
  return template
    .replace(/\{\{date\}\}/g, dateStr)
    .replace(/\{\{address\}\}/g, opts.address)
    .replace(/\{\{signature\}\}/g, opts.signature)
}

/** Resolve template for cancellation/rescheduling */
export function resolveCancellationTemplate(
  template: string,
  opts: { phone: string; signature: string; appointmentDate?: Date; timezoneName?: string }
): string {
  let result = template
    .replace(/\{\{phone\}\}/g, opts.phone)
    .replace(/\{\{signature\}\}/g, opts.signature)
  if (opts.appointmentDate) {
    const tz = getEffectiveTimezone(opts.timezoneName ?? null)
    const dateStr = formatInTimeZone(opts.appointmentDate, tz, "MMMM d, yyyy 'at' h:mm a")
    result = result.replace(/\{\{date\}\}/g, dateStr)
  }
  return result
}

/** Resolve template for 4-hour reminder */
export function resolveReminderTemplate(
  template: string,
  opts: { hoursText: string; address: string; signature: string }
): string {
  return template
    .replace(/\{\{hours\}\}/g, opts.hoursText)
    .replace(/\{\{address\}\}/g, opts.address)
    .replace(/\{\{signature\}\}/g, opts.signature)
}

export interface LifecycleTemplateDemand {
  customer_firstname?: string | null
  customer_lastname?: string | null
  vehicle_year?: number | null
  vehicle_make?: string | null
  vehicle_model?: string | null
}

/** Resolve lifecycle SMS templates (post-completion, warranty). */
export function resolveLifecycleTemplate(
  template: string,
  opts: {
    signature: string
    portalLink?: string
    demand?: LifecycleTemplateDemand
  }
): string {
  const demand = opts.demand
  const customerName = demand
    ? `${demand.customer_firstname ?? ''} ${demand.customer_lastname ?? ''}`.trim()
    : ''
  const vehicleInfo = demand
    ? [demand.vehicle_year, demand.vehicle_make, demand.vehicle_model]
        .filter((p) => p != null && String(p).trim() !== '')
        .map(String)
        .join(' ')
        .trim()
    : ''

  return template
    .replace(/\{\{portal_link\}\}/g, opts.portalLink ?? '')
    .replace(/\{\{signature\}\}/g, opts.signature)
    .replace(/\{\{customer_name\}\}/g, customerName || 'Customer')
    .replace(/\{\{vehicle_info\}\}/g, vehicleInfo || '—')
}
