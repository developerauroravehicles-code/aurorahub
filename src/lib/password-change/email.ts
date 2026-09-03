import { Resend } from 'resend'
import { getMailSettingsWithPassword } from '@/lib/mail-settings'
import { sendEmailViaSMTP } from '@/lib/mail-sender'
import { escapeHtmlForEmail } from '@/lib/email'
import { buildChangePasswordUrl } from './token'
import type { PasswordPromptSettings } from './settings'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

export function buildPasswordChangeEmailHtml(params: {
  fullName: string
  changeUrl: string
  expiresHours: number
  settings: PasswordPromptSettings
}): string {
  const name = escapeHtmlForEmail(params.fullName || 'there')
  const url = escapeHtmlForEmail(params.changeUrl)
  const support = escapeHtmlForEmail(params.settings.supportEmail)
  const phone = params.settings.supportPhone
    ? `<p style="color:#666;font-size:14px;">Phone: ${escapeHtmlForEmail(params.settings.supportPhone)}</p>`
    : ''

  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#C27E00;">Change your AuroraHub password</h2>
      <p>Hi ${name},</p>
      <p>You requested to change your AuroraHub password. Open the secure link below in a <strong>new browser tab</strong> to set a new password:</p>
      <p style="margin:24px 0;">
        <a href="${url}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;background:#C27E00;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
          Change password
        </a>
      </p>
      <p style="color:#666;font-size:14px;word-break:break-all;">Or copy this link:<br/><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>
      <p style="color:#666;font-size:14px;">This link expires in ${params.expiresHours} hour(s) and can only be used once.</p>
      <p style="color:#666;font-size:14px;">If you did not request this, contact <a href="mailto:${support}">${support}</a>.</p>
      ${phone}
      <p style="margin-top:16px;color:#999;font-size:12px;">— AuroraHub</p>
    </div>
  `
}

export async function sendPasswordChangeEmailMessage(params: {
  to: string
  fullName: string
  rawToken: string
  settings: PasswordPromptSettings
}): Promise<{ success: boolean; error?: string }> {
  const changeUrl = buildChangePasswordUrl(params.rawToken)
  const subject = 'AuroraHub — Change your password'
  const html = buildPasswordChangeEmailHtml({
    fullName: params.fullName,
    changeUrl,
    expiresHours: params.settings.tokenTtlHours,
    settings: params.settings,
  })

  const mailSettings = await getMailSettingsWithPassword()
  if (mailSettings) {
    return sendEmailViaSMTP(mailSettings, { to: [params.to], subject, html })
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'Mail is not configured. Contact IT to change your password.' }
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject,
      html,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send email' }
  }
}
