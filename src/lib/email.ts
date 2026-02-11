import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

export interface SendReportEmailParams {
  to: string[]
  subject: string
  reportTitle: string
  exporterFullName: string
  dateRange: string
  pdfBase64: string
  optionalMessage?: string
}

export async function sendReportEmail(params: SendReportEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY is not configured' }
  }

  const { to, subject, reportTitle, exporterFullName, dateRange, pdfBase64, optionalMessage } = params

  if (to.length === 0) {
    return { success: false, error: 'No recipients specified' }
  }

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

  const pdfBuffer = Buffer.from(pdfBase64, 'base64')
  const fileName = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
        },
      ],
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Email send error:', err)
    return { success: false, error: message }
  }
}
