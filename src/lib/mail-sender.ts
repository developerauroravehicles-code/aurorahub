import nodemailer from 'nodemailer'

export interface MailSettings {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  fromEmail: string
  fromName: string
  enabled: boolean
}

export interface SendEmailParams {
  to: string[]
  subject: string
  html: string
  attachments?: Array<{ filename: string; content: Buffer | string }>
}

let cachedTransporter: nodemailer.Transporter | null = null

export async function createMailTransporter(settings: MailSettings): Promise<nodemailer.Transporter> {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.password,
    },
  })
}

export async function sendEmailViaSMTP(
  settings: MailSettings,
  params: SendEmailParams
): Promise<{ success: boolean; error?: string }> {
  if (!settings.enabled) {
    return { success: false, error: 'Mail settings are disabled' }
  }

  if (params.to.length === 0) {
    return { success: false, error: 'No recipients specified' }
  }

  try {
    const transporter = await createMailTransporter(settings)

    const result = await transporter.sendMail({
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: typeof a.content === 'string' ? Buffer.from(a.content, 'base64') : a.content,
      })),
    })

    if (result.rejected?.length) {
      return { success: false, error: `Some recipients rejected: ${result.rejected.join(', ')}` }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('SMTP send error:', err)
    return { success: false, error: message }
  }
}
