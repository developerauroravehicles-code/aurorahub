import { Resend } from 'resend'
import { getMailSettingsWithPassword } from './mail-settings'
import { sendEmailViaSMTP } from './mail-sender'
import { logMailSent } from './mail-logger'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

export interface SendReportEmailParams {
  to: string[]
  subject: string
  reportTitle: string
  exporterFullName: string
  dateRange: string
  pdfBase64?: string
  optionalMessage?: string
  senderId?: string
  mailType?: 'report' | 'scheduled_report'
}

export async function sendReportEmail(params: SendReportEmailParams): Promise<{ success: boolean; error?: string }> {
  const { to, subject, reportTitle, exporterFullName, dateRange, pdfBase64, optionalMessage, senderId, mailType = 'report' } = params

  if (to.length === 0) {
    return { success: false, error: 'No recipients specified' }
  }

  const includeAttachment = pdfBase64 && pdfBase64.length > 0
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #C27E00;">${reportTitle}</h2>
      <p><strong>Date Range:</strong> ${dateRange}</p>
      <p><strong>Exported by:</strong> ${exporterFullName}</p>
      ${optionalMessage ? `<div style="margin: 16px 0; padding: 12px; background: #f5f5f5; border-radius: 8px;"><strong>Message from sender:</strong><br/>${optionalMessage.replace(/\n/g, '<br/>')}</div>` : ''}
      <p style="margin-top: 24px; color: #666; font-size: 14px;">Please find the attached PDF report.</p>
      <p style="margin-top: 16px; color: #999; font-size: 12px;">— AuroraHub</p>
    </div>
  `

  const pdfBuffer = includeAttachment ? Buffer.from(pdfBase64!, 'base64') : Buffer.from('')
  const fileName = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`

  const doLog = (success: boolean, errorMessage?: string) => {
    logMailSent({
      recipientEmails: to,
      subject,
      mailType,
      reportTitle,
      senderId,
      success,
      errorMessage,
    })
  }

  // Prefer SMTP (mail_settings) if configured
  const mailSettings = await getMailSettingsWithPassword()
  if (mailSettings) {
    const result = await sendEmailViaSMTP(mailSettings, {
      to,
      subject,
      html: htmlBody,
      attachments: includeAttachment ? [{ filename: fileName, content: pdfBuffer }] : undefined,
    })
    doLog(result.success, result.error)
    return result
  }

  // Fallback to Resend
  if (!process.env.RESEND_API_KEY) {
    const err = 'RESEND_API_KEY is not configured and mail settings are not set'
    doLog(false, err)
    return { success: false, error: err }
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: htmlBody,
      attachments: includeAttachment
        ? [
            {
              filename: fileName,
              content: pdfBuffer,
            },
          ]
        : undefined,
    })

    if (error) {
      console.error('Resend error:', error)
      doLog(false, error.message)
      return { success: false, error: error.message }
    }

    doLog(true)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Email send error:', err)
    doLog(false, message)
    return { success: false, error: message }
  }
}
