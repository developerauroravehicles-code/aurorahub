import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getAuroraManagerEmails } from '@/lib/alert-dispatch'
import { ptTodayDate } from '@/lib/daily-dealer-invoices'
import { logMailSent } from '@/lib/mail-logger'
import { getMailSettingsWithPassword } from '@/lib/mail-settings'
import { sendEmailViaSMTP } from '@/lib/mail-sender'
import { logSmsSent } from '@/lib/sms-logger'
import { getSmsSettings } from '@/lib/sms-resolver'
import { sendSMS } from '@/lib/twilio'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

export type MissedDailyInvoiceDealer = {
  dealerName: string
  batchId: string
  unapprovedCount: number
  totalCount: number
}

export type MissedDailyInvoiceSummary = {
  batchDate: string
  unapprovedCount: number
  totalIncludedCount: number
  dealers: MissedDailyInvoiceDealer[]
}

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://aurorahub.app')
  )
}

export async function findMissedDailyInvoices(
  supabase: SupabaseClient,
  batchDate: string
): Promise<MissedDailyInvoiceSummary> {
  const empty: MissedDailyInvoiceSummary = {
    batchDate,
    unapprovedCount: 0,
    totalIncludedCount: 0,
    dealers: [],
  }

  const { data: batches } = await supabase
    .from('dealer_daily_invoice_batches')
    .select('id, dealer_id, status, eod_missed_notified_at, dealers(name)')
    .eq('batch_date', batchDate)
    .neq('status', 'sent')

  if (!batches?.length) return empty

  const batchIds = batches.map((b) => b.id as string)
  const { data: items } = await supabase
    .from('dealer_daily_invoice_batch_items')
    .select('batch_id, included, demands(invoice_approved_at, demand_number)')
    .in('batch_id', batchIds)
    .eq('included', true)

  const byBatch = new Map<string, { total: number; unapproved: number }>()
  for (const item of items ?? []) {
    const batchId = item.batch_id as string
    const demand = item.demands as { invoice_approved_at?: string | null } | null
    const cur = byBatch.get(batchId) ?? { total: 0, unapproved: 0 }
    cur.total += 1
    if (!demand?.invoice_approved_at) cur.unapproved += 1
    byBatch.set(batchId, cur)
  }

  const dealers: MissedDailyInvoiceDealer[] = []
  let unapprovedCount = 0
  let totalIncludedCount = 0

  for (const batch of batches) {
    const counts = byBatch.get(batch.id as string)
    if (!counts || counts.unapproved === 0) continue

    const dealerName =
      (Array.isArray(batch.dealers)
        ? batch.dealers[0]?.name
        : (batch.dealers as { name?: string } | null)?.name) ?? 'Dealer'

    dealers.push({
      dealerName,
      batchId: batch.id as string,
      unapprovedCount: counts.unapproved,
      totalCount: counts.total,
    })
    unapprovedCount += counts.unapproved
    totalIncludedCount += counts.total
  }

  dealers.sort((a, b) => a.dealerName.localeCompare(b.dealerName))

  return { batchDate, unapprovedCount, totalIncludedCount, dealers }
}

function buildMissedInvoiceSmsBody(summary: MissedDailyInvoiceSummary, signature: string): string {
  const link = `${appOrigin()}/dashboard/admin/daily-invoices?date=${summary.batchDate}`
  const dealerLine =
    summary.dealers.length <= 3
      ? summary.dealers.map((d) => `${d.dealerName} (${d.unapprovedCount})`).join(', ')
      : `${summary.dealers.length} dealers`

  return `Daily Invoice Reminder

${summary.unapprovedCount} invoice(s) still need approval for ${summary.batchDate} PT.
${dealerLine}

Review: ${link}

${signature}`
}

function buildMissedInvoiceEmailHtml(summary: MissedDailyInvoiceSummary): string {
  const link = `${appOrigin()}/dashboard/admin/daily-invoices?date=${summary.batchDate}`
  const rows = summary.dealers
    .map(
      (d) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${d.dealerName}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${d.unapprovedCount}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${d.totalCount}</td></tr>`
    )
    .join('')

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
      <h2 style="color:#C27E00;">Unapproved daily invoices — ${summary.batchDate} PT</h2>
      <p>${summary.unapprovedCount} invoice(s) were not approved before end of day and will not auto-send tomorrow unless you review them now.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <thead>
          <tr style="background:#f4f4f5;">
            <th style="padding:8px;text-align:left;">Dealer</th>
            <th style="padding:8px;text-align:center;">Unapproved</th>
            <th style="padding:8px;text-align:center;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p><a href="${link}" style="color:#C27E00;font-weight:bold;">Open Daily Invoices</a></p>
      <p style="color:#666;font-size:12px;margin-top:24px;">— Aurora Vehicles</p>
    </div>
  `
}

async function sendMissedInvoiceEmail(summary: MissedDailyInvoiceSummary): Promise<{ sent: number; ok: boolean }> {
  const emails = await getAuroraManagerEmails()
  if (!emails.length) return { sent: 0, ok: false }

  const subject = `[AuroraHub] ${summary.unapprovedCount} daily invoice(s) need approval (${summary.batchDate})`
  const html = buildMissedInvoiceEmailHtml(summary)
  const mailSettings = await getMailSettingsWithPassword()

  let ok = false
  let error: string | undefined

  if (mailSettings) {
    const result = await sendEmailViaSMTP(mailSettings, { to: emails, subject, html })
    ok = result.success ?? false
    error = result.error
  } else if (process.env.RESEND_API_KEY) {
    const { error: resendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: emails,
      subject,
      html,
    })
    ok = !resendError
    error = resendError?.message
  } else {
    console.log('[daily-invoice-missed] Email skipped (no mail config):', subject)
    ok = true
  }

  await logMailSent({
    recipientEmails: emails,
    subject,
    mailType: 'daily_invoice_missed',
    reportTitle: summary.batchDate,
    success: ok,
    errorMessage: error,
  })

  return { sent: emails.length, ok }
}

async function sendMissedInvoiceSms(
  supabase: SupabaseClient,
  summary: MissedDailyInvoiceSummary
): Promise<{ sent: number }> {
  const { data: managers } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'aurora_manager')

  const withPhone = (managers ?? []).filter((m) => m.phone?.trim())
  if (!withPhone.length) return { sent: 0 }

  const settings = await getSmsSettings(supabase)
  const body = buildMissedInvoiceSmsBody(summary, settings.signature)

  let sent = 0
  for (const manager of withPhone) {
    const phone = manager.phone!.trim()
    const result = await sendSMS(phone, body)
    if (result.success) {
      sent += 1
      await logSmsSent({
        phoneNumber: phone,
        recipientType: 'aurora_manager',
        recipientName: manager.full_name ?? undefined,
        messageType: 'daily_invoice_missed',
        triggeredBy: 'system',
        messageContent: body,
      })
    }
  }

  return { sent }
}

/**
 * At end of PT day: notify Aurora Managers if any included daily invoices are still unapproved.
 * Sends in-app notification, SMS, and email (once per batch_date).
 */
export async function notifyDailyInvoiceMissed(
  supabase: SupabaseClient,
  batchDate?: string
): Promise<{
  skipped: boolean
  reason?: string
  summary?: MissedDailyInvoiceSummary
  notified: number
  smsSent: number
  emailSent: number
}> {
  const date = batchDate ?? ptTodayDate()
  const summary = await findMissedDailyInvoices(supabase, date)

  if (summary.unapprovedCount === 0) {
    return { skipped: true, reason: 'No unapproved invoices', notified: 0, smsSent: 0, emailSent: 0 }
  }

  const { data: alreadyNotified } = await supabase
    .from('dealer_daily_invoice_batches')
    .select('id')
    .eq('batch_date', date)
    .not('eod_missed_notified_at', 'is', null)
    .in(
      'id',
      summary.dealers.map((d) => d.batchId)
    )
    .limit(1)

  if (alreadyNotified?.length) {
    return {
      skipped: true,
      reason: 'Already notified for this date',
      summary,
      notified: 0,
      smsSent: 0,
      emailSent: 0,
    }
  }

  const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'aurora_manager')
  if (!managers?.length) {
    return { skipped: true, reason: 'No Aurora Managers', summary, notified: 0, smsSent: 0, emailSent: 0 }
  }

  const link = `/dashboard/admin/daily-invoices?date=${date}`
  const message = `${summary.unapprovedCount} daily invoice(s) still need approval for ${date} PT before auto-send tomorrow.`

  await supabase.from('comm_notifications').insert(
    managers.map((m: { id: string }) => ({
      user_id: m.id,
      type: 'daily_invoice_missed' as const,
      payload: {
        batchDate: date,
        unapprovedCount: summary.unapprovedCount,
        dealerCount: summary.dealers.length,
        dealers: summary.dealers,
        link,
        message,
      },
    }))
  )

  const smsResult = await sendMissedInvoiceSms(supabase, summary)
  const emailResult = await sendMissedInvoiceEmail(summary)

  const now = new Date().toISOString()
  await supabase
    .from('dealer_daily_invoice_batches')
    .update({ eod_missed_notified_at: now })
    .in(
      'id',
      summary.dealers.map((d) => d.batchId)
    )

  return {
    skipped: false,
    summary,
    notified: managers.length,
    smsSent: smsResult.sent,
    emailSent: emailResult.sent,
  }
}

export { ptTodayDate }
