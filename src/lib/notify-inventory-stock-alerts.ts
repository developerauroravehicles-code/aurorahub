import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { getAuroraManagerEmails } from '@/lib/alert-dispatch'
import { logMailSent } from '@/lib/mail-logger'
import { getMailSettingsWithPassword } from '@/lib/mail-settings'
import { sendEmailViaSMTP } from '@/lib/mail-sender'
import { fetchInventoryStockAlerts, type InventoryStockAlert } from '@/lib/inventory-stock-alerts'

const DEDUP_HOURS = 24

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://aurorahub.app')
  )
}

function alertFingerprint(warnings: InventoryStockAlert[]): string {
  const raw = warnings.map((w) => `${w.title}|${w.detail}`).sort().join('\n')
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

function buildEmailHtml(warnings: InventoryStockAlert[], infoCount: number): string {
  const link = `${appOrigin()}/dashboard/admin/inventory?tab=alerts`
  const rows = warnings
    .map(
      (w) =>
        `<li><strong>${escapeHtml(w.title)}</strong><br/><span style="color:#666;font-size:13px;">${escapeHtml(w.detail)}</span></li>`
    )
    .join('')
  return `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #C27E00;">Inventory Stock Alert</h2>
      <p>${warnings.length} warning(s) require attention${infoCount > 0 ? ` (${infoCount} info alert(s) in app only)` : ''}.</p>
      <ul style="line-height: 1.5;">${rows}</ul>
      <p><a href="${link}">Open Inventory → Alerts</a></p>
      <p style="margin-top: 16px; color: #666;">— AuroraHub</p>
    </div>
  `
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function notifyInventoryStockAlerts(
  supabase: SupabaseClient
): Promise<{
  skipped: boolean
  reason?: string
  warnings: number
  notifications: number
  emailsSent: number
  fingerprint?: string
}> {
  const { alerts, summary } = await fetchInventoryStockAlerts(supabase)
  const warnings = alerts.filter((a) => a.level === 'warning')

  const warningsForNotify = warnings.filter((a) => {
    if (a.source === 'custom') {
      return a.notifyInApp !== false || a.notifyEmail !== false
    }
    return true
  })

  if (warningsForNotify.length === 0) {
    return { skipped: true, reason: 'No inventory warnings', warnings: 0, notifications: 0, emailsSent: 0 }
  }

  const fingerprint = alertFingerprint(warningsForNotify)
  const since = new Date()
  since.setHours(since.getHours() - DEDUP_HOURS)

  const { data: recentLog } = await supabase
    .from('alert_logs')
    .select('id')
    .eq('alert_type', 'inventory_stock')
    .eq('entity_type', 'inventory_v2')
    .eq('entity_id', fingerprint)
    .gte('created_at', since.toISOString())
    .limit(1)

  if (recentLog?.length) {
    return {
      skipped: true,
      reason: 'Already notified for this alert set (24h dedup)',
      warnings: warnings.length,
      notifications: 0,
      emailsSent: 0,
      fingerprint,
    }
  }

  const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'aurora_manager')
  if (!managers?.length) {
    return {
      skipped: true,
      reason: 'No Aurora Managers',
      warnings: warnings.length,
      notifications: 0,
      emailsSent: 0,
      fingerprint,
    }
  }

  const link = '/dashboard/admin/inventory?tab=alerts'
  const notifyInAppWarnings = warningsForNotify.filter(
    (a) => a.source !== 'custom' || a.notifyInApp !== false
  )
  const emailWarnings = warningsForNotify.filter(
    (a) => a.source !== 'custom' || a.notifyEmail !== false
  )
  const message = `${warningsForNotify.length} inventory warning(s): ${warningsForNotify
    .slice(0, 3)
    .map((w) => w.title)
    .join('; ')}${warningsForNotify.length > 3 ? '…' : ''}`

  if (notifyInAppWarnings.length > 0) {
    await supabase.from('comm_notifications').insert(
      managers.map((m: { id: string }) => ({
        user_id: m.id,
        type: 'inventory_stock_alert' as const,
        payload: {
          link,
          message,
          warningCount: notifyInAppWarnings.length,
          infoCount: summary.infoCount,
          warnings: notifyInAppWarnings.slice(0, 12),
          summary,
        },
      }))
    )
  }

  let emailsSent = 0
  const emails = await getAuroraManagerEmails()
  const mailSettings = await getMailSettingsWithPassword()

  if (emails.length > 0 && mailSettings && emailWarnings.length > 0) {
    const subject = `AuroraHub: Inventory Alert — ${emailWarnings.length} warning(s)`
    const html = buildEmailHtml(emailWarnings, summary.infoCount)
    const result = await sendEmailViaSMTP(mailSettings, { to: emails, subject, html })
    logMailSent({
      recipientEmails: emails,
      subject,
      mailType: 'alert',
      reportTitle: 'inventory_stock',
      success: result.success ?? false,
      errorMessage: result.error,
    })
    if (result.success) emailsSent = emails.length
  }

  await supabase.from('alert_logs').insert({
    alert_type: 'inventory_stock',
    entity_type: 'inventory_v2',
    entity_id: fingerprint,
    subject: `Inventory: ${warningsForNotify.length} warning(s)`,
    recipient_count: managers.length,
    success: emailsSent > 0 || notifyInAppWarnings.length > 0,
    error_message: emails.length > 0 && emailsSent === 0 ? 'Email send failed or mail not configured' : null,
  })

  return {
    skipped: false,
    warnings: warningsForNotify.length,
    notifications: notifyInAppWarnings.length > 0 ? managers.length : 0,
    emailsSent,
    fingerprint,
  }
}
