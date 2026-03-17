import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getSmsSettings } from '@/lib/sms-resolver'

/**
 * Get reminder config from sms_settings.four_hour_reminder.
 * Used by send-reminders API for hoursBefore and recipient flags.
 */
export async function getReminderAutomationConfig(
  supabaseClient?: SupabaseClient
): Promise<{
  enabled: boolean
  hoursBefore: number
  sendToCustomer: boolean
  sendToSpecialist: boolean
}> {
  const supabase = supabaseClient ?? (await createClient())
  const smsSettings = await getSmsSettings(supabase)
  const rh = smsSettings.four_hour_reminder

  const hours = Number(rh.hoursBefore ?? 4)
  return {
    enabled: rh.enabled,
    hoursBefore: [2, 4, 6].includes(hours) ? hours : 4,
    sendToCustomer: rh.sendToCustomer,
    sendToSpecialist: rh.sendToSpecialist ?? true,
  }
}

/**
 * Get 24-hour reminder config from sms_settings.twenty_four_hour_reminder.
 * Used by send-reminders API for 24h reminder pass.
 */
export async function getReminder24hAutomationConfig(
  supabaseClient?: SupabaseClient
): Promise<{
  enabled: boolean
  sendToCustomer: boolean
  sendToSpecialist: boolean
}> {
  const supabase = supabaseClient ?? (await createClient())
  const smsSettings = await getSmsSettings(supabase)
  const rh = smsSettings.twenty_four_hour_reminder
  return {
    enabled: rh.enabled,
    sendToCustomer: rh.sendToCustomer,
    sendToSpecialist: rh.sendToSpecialist ?? true,
  }
}
