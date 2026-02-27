'use server'

import { createClient } from '@/lib/supabase/server'
import type { MailSettings } from './mail-sender'

const MAIL_SETTINGS_KEY = 'mail_settings'

const DEFAULT_MAIL_SETTINGS: MailSettings = {
  host: '',
  port: 587,
  secure: false,
  user: '',
  password: '',
  fromEmail: '',
  fromName: 'AuroraHub',
  enabled: false,
}

export async function getMailSettings(): Promise<MailSettings | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', MAIL_SETTINGS_KEY)
    .single()

  if (error || !data?.value) return null

  try {
    const parsed = JSON.parse(data.value) as Partial<MailSettings>
    return {
      ...DEFAULT_MAIL_SETTINGS,
      ...parsed,
      password: parsed.password ?? '', // Don't expose stored password in reads - we store it but typically won't return it for security
    }
  } catch {
    return null
  }
}

/** Returns mail settings including password (for sending). Only use server-side. */
export async function getMailSettingsWithPassword(): Promise<MailSettings | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', MAIL_SETTINGS_KEY)
    .single()

  if (error || !data?.value) return null

  try {
    const parsed = JSON.parse(data.value) as Partial<MailSettings>
    const settings: MailSettings = {
      ...DEFAULT_MAIL_SETTINGS,
      ...parsed,
      password: (parsed as { password?: string }).password ?? '',
    }
    return settings.enabled && settings.host && settings.user ? settings : null
  } catch {
    return null
  }
}

export async function saveMailSettings(settings: Partial<MailSettings>): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') return { error: 'Only Aurora Managers can save mail settings' }

  const { data: existing } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', MAIL_SETTINGS_KEY)
    .single()

  let currentPassword = ''
  if (existing?.value) {
    try {
      const parsed = JSON.parse(existing.value) as { password?: string }
      currentPassword = parsed.password ?? ''
    } catch {
      // ignore
    }
  }

  const newPassword = (settings as { password?: string }).password
  const keepPassword = !newPassword || newPassword === ''

  const merged: MailSettings = {
    ...DEFAULT_MAIL_SETTINGS,
    ...(existing?.value ? JSON.parse(existing.value) : {}),
    ...settings,
    password: keepPassword ? currentPassword : newPassword,
  }

  const { error } = await supabase
    .from('system_settings')
    .upsert(
      {
        key: MAIL_SETTINGS_KEY,
        value: JSON.stringify(merged),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )

  if (error) return { error: error.message }
  return {}
}
