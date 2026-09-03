import type { SupabaseClient } from '@supabase/supabase-js'

export const PASSWORD_PROMPT_SETTINGS_KEY = 'password_prompt_settings'

export interface PasswordPromptSettings {
  intervalDays: number
  tokenTtlHours: number
  supportEmail: string
  supportPhone: string
}

export const DEFAULT_PASSWORD_PROMPT_SETTINGS: PasswordPromptSettings = {
  intervalDays: 180,
  tokenTtlHours: 24,
  supportEmail: 'support@auroravehicles.com',
  supportPhone: '',
}

export function parsePasswordPromptSettings(raw: string | null | undefined): PasswordPromptSettings {
  if (!raw) return { ...DEFAULT_PASSWORD_PROMPT_SETTINGS }
  try {
    const parsed = JSON.parse(raw) as Partial<PasswordPromptSettings>
    return {
      intervalDays: Math.max(1, Number(parsed.intervalDays) || DEFAULT_PASSWORD_PROMPT_SETTINGS.intervalDays),
      tokenTtlHours: Math.max(1, Number(parsed.tokenTtlHours) || DEFAULT_PASSWORD_PROMPT_SETTINGS.tokenTtlHours),
      supportEmail: String(parsed.supportEmail ?? DEFAULT_PASSWORD_PROMPT_SETTINGS.supportEmail).trim(),
      supportPhone: String(parsed.supportPhone ?? '').trim(),
    }
  } catch {
    return { ...DEFAULT_PASSWORD_PROMPT_SETTINGS }
  }
}

export async function getPasswordPromptSettings(
  supabaseClient?: SupabaseClient
): Promise<PasswordPromptSettings> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = supabaseClient ?? (await createClient())
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', PASSWORD_PROMPT_SETTINGS_KEY)
    .maybeSingle()

  return parsePasswordPromptSettings(data?.value)
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}
