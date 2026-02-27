import { createAdminClient } from '@/lib/supabase/admin'

export interface MailLogParams {
  recipientEmails: string[]
  subject: string
  mailType: string
  reportTitle?: string
  senderId?: string
  success: boolean
  errorMessage?: string
}

export async function logMailSent(params: MailLogParams): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('mail_logs').insert({
      recipient_emails: params.recipientEmails,
      subject: params.subject,
      mail_type: params.mailType,
      report_title: params.reportTitle ?? null,
      sender_id: params.senderId ?? null,
      success: params.success,
      error_message: params.errorMessage ?? null,
    })
  } catch (err) {
    console.error('Failed to log mail:', err)
  }
}
