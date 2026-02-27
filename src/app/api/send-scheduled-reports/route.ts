import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveReportData, type ReportScope, type ReportPeriod } from '@/lib/report-data-resolver'
import { generateReportPdfBase64 } from '@/lib/export-report-pdf'
import { getMailSettingsWithPassword } from '@/lib/mail-settings'
import { sendEmailViaSMTP } from '@/lib/mail-sender'
import { sendReportEmail } from '@/lib/email'
import { logMailSent } from '@/lib/mail-logger'

const REPORTING_TEMPLATE_MAP: Record<
  string,
  { scope: ReportScope; period: ReportPeriod }
> = {
  daily_report_sales: { scope: 'sales', period: 'daily' },
  daily_report_finance: { scope: 'finance', period: 'daily' },
  daily_report_admin: { scope: 'admin', period: 'daily' },
  daily_report_specialist: { scope: 'specialist', period: 'daily' },
  daily_report_email: { scope: 'admin', period: 'daily' },
  weekly_report_sales: { scope: 'sales', period: 'weekly' },
  weekly_report_finance: { scope: 'finance', period: 'weekly' },
  weekly_report_admin: { scope: 'admin', period: 'weekly' },
  weekly_report_specialist: { scope: 'specialist', period: 'weekly' },
  weekly_summary: { scope: 'admin', period: 'weekly' },
  monthly_report_admin: { scope: 'admin', period: 'monthly' },
}

async function getRecipientEmails(
  recipientType: string,
  customEmails: string,
  supabaseAdmin: ReturnType<typeof createAdminClient>
): Promise<string[]> {
  if (recipientType === 'custom' && customEmails?.trim()) {
    const emails = customEmails
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes('@'))
    return Promise.resolve([...new Set(emails)])
  }

  if (recipientType === 'aurora_manager' || recipientType === 'role_based') {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'aurora_manager')
    if (!data?.length) return []
    const emails = await Promise.all(
      data.map((p) =>
        supabaseAdmin.auth.admin.getUserById(p.id).then((r) => r.data?.user?.email)
      )
    )
    return emails.filter((e): e is string => !!e && e.includes('@'))
  }

  return Promise.resolve([])
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const supabaseAdmin = createAdminClient()

  const { data: settingsRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'automation_settings')
    .single()

  if (!settingsRow?.value) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No automation settings' })
  }

  let automations: Array<{ templateId: string; enabled: boolean; params: Record<string, unknown> }> = []
  try {
    const parsed = JSON.parse(settingsRow.value) as { automations?: Array<{ templateId: string; enabled: boolean; params?: Record<string, unknown> }> }
    automations = (parsed.automations ?? [])
      .filter((a) => a.templateId && REPORTING_TEMPLATE_MAP[a.templateId] && a.enabled)
      .map((a) => ({ ...a, params: a.params ?? {} }))
  } catch {
    return NextResponse.json({ ok: true, sent: 0, message: 'Invalid automation settings' })
  }

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const dayOfWeek = now.getDay()
  const dayOfMonth = now.getDate()

  let sent = 0
  const errors: string[] = []

  for (const auto of automations) {
    const mapping = REPORTING_TEMPLATE_MAP[auto.templateId]
    if (!mapping) continue

    const scheduleTime = String(auto.params?.scheduleTime ?? '09:00')
    const [h, m] = scheduleTime.split(':').map(Number)
    const scheduledHour = isNaN(h) ? 9 : h
    const scheduledMinute = isNaN(m) ? 0 : m

    const period = mapping.period
    let shouldRun = false
    if (period === 'daily') {
      shouldRun = currentHour === scheduledHour
    } else if (period === 'weekly') {
      shouldRun = dayOfWeek === 1 && currentHour === scheduledHour
    } else if (period === 'monthly') {
      shouldRun = dayOfMonth === 1 && currentHour === scheduledHour
    }

    if (!shouldRun) continue

    const { scope, period: p } = mapping
    const dealerId = (auto.params?.dealerId as string) || undefined

    const { options, error: resolveError } = await resolveReportData(
      scope,
      p,
      dealerId
    )

    if (resolveError || !options.reportTitle) {
      errors.push(`${auto.templateId}: ${resolveError ?? 'No options'}`)
      continue
    }

    const emails = await getRecipientEmails(
      String(auto.params?.recipientType ?? 'aurora_manager'),
      String(auto.params?.customEmails ?? ''),
      supabaseAdmin
    )

    if (emails.length === 0) {
      errors.push(`${auto.templateId}: No recipients`)
      continue
    }

    const pdfBase64 = generateReportPdfBase64(options)
    const includePdf = auto.params?.includePdfAttachment !== false

    const mailSettings = await getMailSettingsWithPassword()
    const subject = `${options.reportTitle} - ${options.dateRange}`

    if (mailSettings) {
      const htmlBody = `
        <div style="font-family: Arial, sans-serif;">
          <h2 style="color: #C27E00;">${options.reportTitle}</h2>
          <p><strong>Date Range:</strong> ${options.dateRange}</p>
          <p><strong>Total Demands:</strong> ${options.totalDemands}</p>
          <p><strong>Total Appointments:</strong> ${options.totalAppointments}</p>
          <p style="margin-top: 16px; color: #666;">— AuroraHub System</p>
        </div>
      `
      const result = await sendEmailViaSMTP(mailSettings, {
        to: emails,
        subject,
        html: htmlBody,
        attachments: includePdf
          ? [
              {
                filename: `${options.reportTitle.replace(/\s+/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`,
                content: Buffer.from(pdfBase64, 'base64'),
              },
            ]
          : undefined,
      })
      logMailSent({
        recipientEmails: emails,
        subject,
        mailType: 'scheduled_report',
        reportTitle: options.reportTitle,
        success: result.success,
        errorMessage: result.error,
      })
      if (result.success) sent++
      else errors.push(`${auto.templateId}: ${result.error}`)
    } else {
      const result = await sendReportEmail({
        to: emails,
        subject,
        reportTitle: options.reportTitle,
        exporterFullName: options.exporterFullName,
        dateRange: options.dateRange,
        pdfBase64: includePdf ? pdfBase64 : undefined,
        optionalMessage: undefined,
        mailType: 'scheduled_report',
      })
      if (result.success) sent++
      else errors.push(`${auto.templateId}: ${result.error}`)
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    errors: errors.length > 0 ? errors : undefined,
  })
}
