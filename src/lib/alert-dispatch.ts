import { createAdminClient } from '@/lib/supabase/admin'
import { getMailSettingsWithPassword } from '@/lib/mail-settings'
import { sendEmailViaSMTP } from '@/lib/mail-sender'
import { logMailSent } from '@/lib/mail-logger'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const ALERT_SETTINGS_KEY = 'alert_settings'

/** Get email addresses for IT and Aurora Manager roles (for alert recipients) */
export async function getAlertRecipientEmails(): Promise<string[]> {
  const supabase = createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['it', 'aurora_manager'])

  if (!profiles?.length) return []

  const emails: string[] = []
  for (const p of profiles) {
    const { data } = await supabase.auth.admin.getUserById(p.id)
    if (data?.user?.email) emails.push(data.user.email)
  }
  return [...new Set(emails)]
}

/** Send alert email to IT and Aurora Manager users */
export async function sendAlertEmail(params: {
  subject: string
  html: string
  alertType: string
  entityType?: string
  entityId?: string
}): Promise<{ success: boolean; recipientCount: number; error?: string }> {
  const emails = await getAlertRecipientEmails()
  if (emails.length === 0) {
    return { success: false, recipientCount: 0, error: 'No IT or Aurora Manager recipients found' }
  }

  const mailSettings = await getMailSettingsWithPassword()

  const doSend = async () => {
    if (mailSettings) {
      return sendEmailViaSMTP(mailSettings, {
        to: emails,
        subject: params.subject,
        html: params.html,
      })
    }
    if (!process.env.RESEND_API_KEY) {
      return { success: false, error: 'RESEND_API_KEY not configured and mail settings not set' }
    }
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: emails,
      subject: params.subject,
      html: params.html,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  const result = await doSend()

  logMailSent({
    recipientEmails: emails,
    subject: params.subject,
    mailType: 'alert',
    reportTitle: params.alertType,
    success: result.success,
    errorMessage: result.error,
  })

  return {
    success: result.success ?? false,
    recipientCount: emails.length,
    error: result.error,
  }
}

/** Called when a critical ticket is created - sends immediate alert if rule is enabled */
export async function sendNewCriticalTicketAlertIfEnabled(ticket: {
  id: string
  ticket_number: string | null
  title: string
}): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { data: settingsRow } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', ALERT_SETTINGS_KEY)
      .single()

    let ruleEnabled = true
    if (settingsRow?.value) {
      try {
        const parsed = JSON.parse(settingsRow.value) as { rules?: Array<{ type: string; enabled: boolean }> }
        const rule = parsed.rules?.find((r) => r.type === 'new_critical_ticket')
        ruleEnabled = rule?.enabled ?? true
      } catch {
        // keep default true
      }
    }
    if (!ruleEnabled) return

    const emails = await getAlertRecipientEmails()
    if (emails.length === 0) return

    const mailSettings = await getMailSettingsWithPassword()
    if (!mailSettings) return

    const ticketNum = ticket.ticket_number ?? ticket.id.slice(0, 8)
    const subject = `AuroraHub Alert: New Critical Ticket - ${ticketNum}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="color: #dc2626;">New Critical Ticket</h2>
        <p><strong>Ticket:</strong> ${ticketNum}</p>
        <p><strong>Title:</strong> ${ticket.title}</p>
        <p><a href="${appUrl}/dashboard/operations/service-desk?tab=tickets">View in Service Desk</a></p>
        <p style="margin-top: 16px; color: #666;">— AuroraHub Alerts</p>
      </div>
    `
    const result = await sendEmailViaSMTP(mailSettings, { to: emails, subject, html })
    logMailSent({
      recipientEmails: emails,
      subject,
      mailType: 'alert',
      reportTitle: 'new_critical_ticket',
      success: result.success ?? false,
      errorMessage: result.error,
    })
    await supabase.from('alert_logs').insert({
      alert_type: 'new_critical_ticket',
      entity_type: 'it_ticket',
      entity_id: ticket.id,
      subject,
      recipient_count: emails.length,
      success: result.success ?? false,
      error_message: result.error ?? null,
    })
  } catch (err) {
    console.error('sendNewCriticalTicketAlertIfEnabled failed:', err)
  }
}

/** Called when a critical incident is created - sends immediate alert if rule is enabled */
export async function sendCriticalIncidentAlertIfEnabled(incident: {
  id: string
  incident_number: string | null
  title: string
  status: string
}): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { data: settingsRow } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', ALERT_SETTINGS_KEY)
      .single()

    let ruleEnabled = true
    if (settingsRow?.value) {
      try {
        const parsed = JSON.parse(settingsRow.value) as { rules?: Array<{ type: string; enabled: boolean }> }
        const rule = parsed.rules?.find((r) => r.type === 'critical_incident')
        ruleEnabled = rule?.enabled ?? true
      } catch {
        // keep default true
      }
    }
    if (!ruleEnabled) return

    const emails = await getAlertRecipientEmails()
    if (emails.length === 0) return

    const mailSettings = await getMailSettingsWithPassword()
    if (!mailSettings) return

    const incNum = incident.incident_number ?? incident.id.slice(0, 8)
    const subject = `AuroraHub Alert: Critical Incident - ${incNum}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="color: #dc2626;">Critical Incident</h2>
        <p><strong>Incident:</strong> ${incNum}</p>
        <p><strong>Title:</strong> ${incident.title}</p>
        <p><strong>Status:</strong> ${incident.status}</p>
        <p><a href="${appUrl}/dashboard/operations/service-desk?tab=incidents">View in Service Desk</a></p>
        <p style="margin-top: 16px; color: #666;">— AuroraHub Alerts</p>
      </div>
    `
    const result = await sendEmailViaSMTP(mailSettings, { to: emails, subject, html })
    logMailSent({
      recipientEmails: emails,
      subject,
      mailType: 'alert',
      reportTitle: 'critical_incident',
      success: result.success ?? false,
      errorMessage: result.error,
    })
    await supabase.from('alert_logs').insert({
      alert_type: 'critical_incident',
      entity_type: 'it_incident',
      entity_id: incident.id,
      subject,
      recipient_count: emails.length,
      success: result.success ?? false,
      error_message: result.error ?? null,
    })
  } catch (err) {
    console.error('sendCriticalIncidentAlertIfEnabled failed:', err)
  }
}
