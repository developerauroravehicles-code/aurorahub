import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone } from './timezone-defaults'
import type { SMSSettings } from './sms-settings'
import { DEFAULT_SMS_SETTINGS } from './sms-settings'

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
      appointment_created: { ...DEFAULT_SMS_SETTINGS.appointment_created, ...parsed.appointment_created },
      cancellation_notice: { ...DEFAULT_SMS_SETTINGS.cancellation_notice, ...parsed.cancellation_notice },
      rescheduling_notice: { ...DEFAULT_SMS_SETTINGS.rescheduling_notice, ...parsed.rescheduling_notice },
      four_hour_reminder: { ...DEFAULT_SMS_SETTINGS.four_hour_reminder, ...parsed.four_hour_reminder },
      twenty_four_hour_reminder: { ...DEFAULT_SMS_SETTINGS.twenty_four_hour_reminder, ...parsed.twenty_four_hour_reminder },
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
