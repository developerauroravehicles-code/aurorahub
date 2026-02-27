import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Get reminder automation config from automation_settings.
 * Used by send-reminders API to determine hoursBefore and recipient flags.
 * If no enabled sms_reminder_4h automation exists, returns enabled: false.
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
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'automation_settings')
    .single()

  const defaults = {
    enabled: true,
    hoursBefore: 4,
    sendToCustomer: true,
    sendToSpecialist: true,
  }
  if (!data?.value) return defaults

  try {
    const parsed = JSON.parse(data.value) as {
      automations?: Array<{
        templateId: string
        enabled: boolean
        params?: Record<string, unknown>
      }>
    }
    const reminder = parsed.automations?.find(
      (a) => a.templateId === 'sms_reminder_4h' && a.enabled
    )
    if (!reminder) {
      return { ...defaults, enabled: false }
    }
    const hours = Number(reminder.params?.hoursBefore ?? 4)
    return {
      enabled: true,
      hoursBefore: [2, 4, 6].includes(hours) ? hours : 4,
      sendToCustomer: Boolean(reminder.params?.sendToCustomer ?? true),
      sendToSpecialist: Boolean(reminder.params?.sendToSpecialist ?? true),
    }
  } catch {
    return defaults
  }
}
