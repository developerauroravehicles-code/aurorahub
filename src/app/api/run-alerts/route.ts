import { NextResponse } from 'next/server'
import { formatInTimeZone } from 'date-fns-tz'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMailSettingsWithPassword } from '@/lib/mail-settings'
import { sendEmailViaSMTP } from '@/lib/mail-sender'
import { getAlertRecipientEmails } from '@/lib/alert-dispatch'
import { logMailSent } from '@/lib/mail-logger'

const ALERT_SETTINGS_KEY = 'alert_settings'
const DEDUP_HOURS = 24

export type AlertRuleType =
  | 'sla_breach_ticket'
  | 'critical_incident'
  | 'low_stock'
  | 'new_critical_ticket'

interface AlertRule {
  id: string
  type: AlertRuleType
  enabled: boolean
  name: string
  params?: Record<string, unknown>
}

interface AlertSettings {
  rules: AlertRule[]
}

function defaultAlertSettings(): AlertSettings {
  return {
    rules: [
      { id: 'sla_breach', type: 'sla_breach_ticket', enabled: true, name: 'SLA Breach (Ticket)', params: {} },
      { id: 'critical_incident', type: 'critical_incident', enabled: true, name: 'Critical Incident', params: {} },
      { id: 'low_stock', type: 'low_stock', enabled: true, name: 'Low Stock', params: { threshold: 5 } },
      { id: 'new_critical_ticket', type: 'new_critical_ticket', enabled: true, name: 'New Critical Ticket', params: {} },
    ],
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  let settings: AlertSettings
  const { data: settingsRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', ALERT_SETTINGS_KEY)
    .single()

  if (settingsRow?.value) {
    try {
      settings = JSON.parse(settingsRow.value) as AlertSettings
      settings.rules = settings.rules ?? defaultAlertSettings().rules
    } catch {
      settings = defaultAlertSettings()
    }
  } else {
    settings = defaultAlertSettings()
  }

  const mailSettings = await getMailSettingsWithPassword()
  if (!mailSettings) {
    return NextResponse.json({
      ok: true,
      alerts: 0,
      message: 'Mail not configured. Configure mail settings to receive alerts.',
    })
  }

  const emails = await getAlertRecipientEmails()
  if (emails.length === 0) {
    return NextResponse.json({
      ok: true,
      alerts: 0,
      message: 'No IT or Aurora Manager users with email found.',
    })
  }

  const sentAlerts: Array<{ type: string; count: number }> = []
  const errors: string[] = []

  const alreadySent = async (alertType: string, entityType: string, entityId: string) => {
    const since = new Date()
    since.setHours(since.getHours() - DEDUP_HOURS)
    const { data } = await supabase
      .from('alert_logs')
      .select('id')
      .eq('alert_type', alertType)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .gte('created_at', since.toISOString())
      .limit(1)
    return (data?.length ?? 0) > 0
  }

  const logAlert = async (p: {
    alertType: string
    entityType: string
    entityId: string
    subject: string
    recipientCount: number
    success: boolean
    errorMessage?: string
  }) => {
    await supabase.from('alert_logs').insert({
      alert_type: p.alertType,
      entity_type: p.entityType,
      entity_id: p.entityId,
      subject: p.subject,
      recipient_count: p.recipientCount,
      success: p.success,
      error_message: p.errorMessage ?? null,
    })
  }

  for (const rule of settings.rules) {
    if (!rule.enabled) continue

    if (rule.type === 'sla_breach_ticket') {
      const { data: tickets } = await supabase
        .from('it_tickets')
        .select('id, ticket_number, title, sla_due_at')
        .not('sla_due_at', 'is', null)
        .not('status', 'in', '("resolved","closed")')
        .lt('sla_due_at', new Date().toISOString())

      for (const t of tickets ?? []) {
        if (await alreadySent('sla_breach_ticket', 'it_ticket', t.id)) continue
        const subject = `AuroraHub Alert: SLA Breach - ${t.ticket_number}`
        const html = `
          <div style="font-family: Arial, sans-serif;">
            <h2 style="color: #C27E00;">SLA Breach Alert</h2>
            <p><strong>Ticket:</strong> ${t.ticket_number}</p>
            <p><strong>Title:</strong> ${t.title}</p>
            <p><strong>SLA Due:</strong> ${formatInTimeZone(new Date(t.sla_due_at), 'America/Vancouver', 'MMM d, yyyy h:mm a')}</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/operations/service-desk?tab=tickets">View in Service Desk</a></p>
            <p style="margin-top: 16px; color: #666;">— AuroraHub Alerts</p>
          </div>
        `
        const result = await sendEmailViaSMTP(mailSettings, { to: emails, subject, html })
        logMailSent({
          recipientEmails: emails,
          subject,
          mailType: 'alert',
          reportTitle: 'sla_breach_ticket',
          success: result.success,
          errorMessage: result.error,
        })
        await logAlert({
          alertType: 'sla_breach_ticket',
          entityType: 'it_ticket',
          entityId: t.id,
          subject,
          recipientCount: emails.length,
          success: result.success ?? false,
          errorMessage: result.error,
        })
        if (result.success) {
          sentAlerts.push({ type: 'sla_breach_ticket', count: 1 })
        } else {
          errors.push(result.error ?? 'Send failed')
        }
      }
    }

    if (rule.type === 'critical_incident') {
      const { data: incidents } = await supabase
        .from('it_incidents')
        .select('id, incident_number, title, severity, status')
        .eq('severity', 'critical')
        .not('status', 'in', '("resolved","closed")')

      for (const inc of incidents ?? []) {
        if (await alreadySent('critical_incident', 'it_incident', inc.id)) continue
        const subject = `AuroraHub Alert: Critical Incident - ${inc.incident_number}`
        const html = `
          <div style="font-family: Arial, sans-serif;">
            <h2 style="color: #dc2626;">Critical Incident</h2>
            <p><strong>Incident:</strong> ${inc.incident_number}</p>
            <p><strong>Title:</strong> ${inc.title}</p>
            <p><strong>Severity:</strong> Critical</p>
            <p><strong>Status:</strong> ${inc.status}</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/operations/service-desk?tab=incidents">View in Service Desk</a></p>
            <p style="margin-top: 16px; color: #666;">— AuroraHub Alerts</p>
          </div>
        `
        const result = await sendEmailViaSMTP(mailSettings, { to: emails, subject, html })
        logMailSent({
          recipientEmails: emails,
          subject,
          mailType: 'alert',
          reportTitle: 'critical_incident',
          success: result.success,
          errorMessage: result.error,
        })
        await logAlert({
          alertType: 'critical_incident',
          entityType: 'it_incident',
          entityId: inc.id,
          subject,
          recipientCount: emails.length,
          success: result.success ?? false,
          errorMessage: result.error,
        })
        if (result.success) {
          sentAlerts.push({ type: 'critical_incident', count: 1 })
        } else {
          errors.push(result.error ?? 'Send failed')
        }
      }
    }

    if (rule.type === 'low_stock') {
      const { notifyInventoryStockAlerts } = await import('@/lib/notify-inventory-stock-alerts')
      const result = await notifyInventoryStockAlerts(supabase)
      if (!result.skipped && result.warnings > 0) {
        sentAlerts.push({ type: 'inventory_stock', count: result.warnings })
      } else if (result.skipped && result.reason && result.reason !== 'No inventory warnings') {
        // dedup or config skip — no error
      }
      continue
    }

    if (rule.type === 'new_critical_ticket') {
      const since = new Date()
      since.setHours(since.getHours() - 1)
      const { data: tickets } = await supabase
        .from('it_tickets')
        .select('id, ticket_number, title')
        .eq('priority', 'critical')
        .eq('status', 'open')
        .gte('created_at', since.toISOString())

      for (const t of tickets ?? []) {
        if (await alreadySent('new_critical_ticket', 'it_ticket', t.id)) continue
        const subject = `AuroraHub Alert: New Critical Ticket - ${t.ticket_number}`
        const html = `
          <div style="font-family: Arial, sans-serif;">
            <h2 style="color: #dc2626;">New Critical Ticket</h2>
            <p><strong>Ticket:</strong> ${t.ticket_number}</p>
            <p><strong>Title:</strong> ${t.title}</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/operations/service-desk?tab=tickets">View in Service Desk</a></p>
            <p style="margin-top: 16px; color: #666;">— AuroraHub Alerts</p>
          </div>
        `
        const result = await sendEmailViaSMTP(mailSettings, { to: emails, subject, html })
        logMailSent({
          recipientEmails: emails,
          subject,
          mailType: 'alert',
          reportTitle: 'new_critical_ticket',
          success: result.success,
          errorMessage: result.error,
        })
        await logAlert({
          alertType: 'new_critical_ticket',
          entityType: 'it_ticket',
          entityId: t.id,
          subject,
          recipientCount: emails.length,
          success: result.success ?? false,
          errorMessage: result.error,
        })
        if (result.success) {
          sentAlerts.push({ type: 'new_critical_ticket', count: 1 })
        } else {
          errors.push(result.error ?? 'Send failed')
        }
      }
    }
  }

  const totalSent = sentAlerts.reduce((a, b) => a + b.count, 0)
  return NextResponse.json({
    ok: true,
    alerts: totalSent,
    details: sentAlerts,
    errors: errors.length > 0 ? errors : undefined,
  })
}
