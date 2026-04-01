'use server'

import { getMailSettings, getMailSettingsWithPassword, saveMailSettings } from '@/lib/mail-settings'
import { sendEmailViaSMTP } from '@/lib/mail-sender'
import type { MailSettings } from '@/lib/mail-sender'
import { normalizeEmail } from '@/lib/email-normalize'

export async function loadMailSettings(): Promise<{ settings: Partial<MailSettings> | null; error?: string }> {
  const settings = await getMailSettings()
  if (!settings) return { settings: null }
  return {
    settings: {
      ...settings,
      fromEmail: settings.fromEmail ? normalizeEmail(settings.fromEmail) : settings.fromEmail,
      password: '', // Never send password to client
    },
  }
}

export async function saveMailSettingsAction(settings: Partial<MailSettings>): Promise<{ error?: string }> {
  return saveMailSettings(settings)
}

export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; error?: string }> {
  const settings = await getMailSettingsWithPassword()
  if (!settings) {
    return { success: false, error: 'Mail settings not configured or disabled' }
  }

  const to = normalizeEmail(toEmail)
  if (!to) return { success: false, error: 'Enter a valid email address' }

  return sendEmailViaSMTP(settings, {
    to: [to],
    subject: 'AuroraHub Test Email',
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="color: #C27E00;">AuroraHub Mail Test</h2>
        <p>This is a test email from your AuroraHub mail settings.</p>
        <p>If you received this, SMTP configuration is working correctly.</p>
        <p style="color: #666; font-size: 12px;">— AuroraHub System</p>
      </div>
    `,
  })
}
