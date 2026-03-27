import { Resend } from 'resend'
import { getMailSettingsWithPassword } from './mail-settings'
import { sendEmailViaSMTP } from './mail-sender'
import { logMailSent } from './mail-logger'
import type { StatementRowData } from './generate-statement-pdf'
import type { InvoiceRowData } from './generate-invoice-pdf'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Split comma/semicolon-separated list and keep valid-looking emails. */
export function parseEmailRecipients(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[,;\n]+/)) {
    const t = part.trim().toLowerCase()
    if (!t || !EMAIL_RE.test(t) || seen.has(t)) continue
    seen.add(t)
    out.push(part.trim())
  }
  return out
}

/** Escape text for safe insertion into HTML email bodies. */
export function escapeHtmlForEmail(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * HTML fragment listing statement line items (same rows as the PDF for the selected period).
 * Caller must only pass data already shown in the app; all text is escaped.
 */
export function buildStatementInvoicesEmailHtml(rows: StatementRowData[]): string {
  if (rows.length === 0) return ''

  const fmt = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2)
  let subtotal = 0
  let taxSum = 0

  const bodyRows = rows
    .map((r) => {
      subtotal += r.price
      taxSum += r.tax
      const lineTotal = r.price + r.tax
      const inv =
        r.demand_number != null && String(r.demand_number).trim() !== ''
          ? escapeHtmlForEmail(String(r.demand_number))
          : '—'
      return `<tr>
      <td style="padding:8px;border:1px solid #e5e5e5;">${inv}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;white-space:nowrap;">${escapeHtmlForEmail(r.date)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${escapeHtmlForEmail(r.vehicleModel)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${escapeHtmlForEmail(r.stockNumber)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:right;">$${fmt(r.price)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:right;">$${fmt(r.tax)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:right;font-weight:600;">$${fmt(lineTotal)}</td>
    </tr>`
    })
    .join('')

  const grand = subtotal + taxSum

  return `
    <div style="margin-top:20px;">
      <p style="font-weight:bold;color:#333;margin-bottom:8px;font-size:14px;">Invoices in this period (${rows.length})</p>
      <table role="presentation" style="border-collapse:collapse;width:100%;max-width:700px;font-size:13px;color:#222;">
        <thead>
          <tr style="background:#C27E00;color:#fff;">
            <th style="padding:8px 10px;border:1px solid #a06900;text-align:left;">Invoice</th>
            <th style="padding:8px 10px;border:1px solid #a06900;text-align:left;">Complete date</th>
            <th style="padding:8px 10px;border:1px solid #a06900;text-align:left;">Vehicle</th>
            <th style="padding:8px 10px;border:1px solid #a06900;text-align:left;">Stock</th>
            <th style="padding:8px 10px;border:1px solid #a06900;text-align:right;">Price (CAD)</th>
            <th style="padding:8px 10px;border:1px solid #a06900;text-align:right;">Tax (CAD)</th>
            <th style="padding:8px 10px;border:1px solid #a06900;text-align:right;">Total (CAD)</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
          <tr style="background:#f5f5f5;font-weight:bold;">
            <td colspan="4" style="padding:8px 10px;border:1px solid #e5e5e5;">Totals</td>
            <td style="padding:8px 10px;border:1px solid #e5e5e5;text-align:right;">$${fmt(subtotal)}</td>
            <td style="padding:8px 10px;border:1px solid #e5e5e5;text-align:right;">$${fmt(taxSum)}</td>
            <td style="padding:8px 10px;border:1px solid #e5e5e5;text-align:right;">$${fmt(grand)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `
}

/** Summary table for bulk invoice emails (matches PDF list). */
export function buildBulkInvoicesSummaryHtml(items: InvoiceRowData[]): string {
  if (items.length === 0) return ''

  const bodyRows = items
    .map((d) => {
      const inv =
        d.demand_number != null && String(d.demand_number).trim() !== ''
          ? escapeHtmlForEmail(String(d.demand_number))
          : '—'
      return `<tr>
      <td style="padding:8px;border:1px solid #e5e5e5;">${inv}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${escapeHtmlForEmail(d.customerName)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;white-space:nowrap;">${escapeHtmlForEmail(d.completeDate)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:right;">${escapeHtmlForEmail(d.totalAmount)} CAD</td>
    </tr>`
    })
    .join('')

  return `
    <div style="margin-top:20px;">
      <p style="font-weight:bold;color:#333;margin-bottom:8px;font-size:14px;">Invoices attached (${items.length})</p>
      <table role="presentation" style="border-collapse:collapse;width:100%;max-width:640px;font-size:13px;color:#222;">
        <thead>
          <tr style="background:#C27E00;color:#fff;">
            <th style="padding:8px 10px;border:1px solid #a06900;text-align:left;">Invoice</th>
            <th style="padding:8px 10px;border:1px solid #a06900;text-align:left;">Bill to</th>
            <th style="padding:8px 10px;border:1px solid #a06900;text-align:left;">Complete date</th>
            <th style="padding:8px 10px;border:1px solid #a06900;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `
}

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

export interface SendDocumentPdfEmailParams {
  to: string[]
  subject: string
  documentTitle: string
  bodyIntro: string
  pdfBase64: string
  fileName: string
  senderId?: string
  mailType: 'invoice' | 'statement'
  /** Pre-built valid HTML fragment (e.g. statement line items table). Inserted between intro and attachment notice. */
  bodyHtmlExtra?: string
}

/** Send a single PDF attachment (invoice or dealer statement). Uses SMTP from mail_settings when set, else Resend. */
export async function sendDocumentPdfEmail(
  params: SendDocumentPdfEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { to, subject, documentTitle, bodyIntro, pdfBase64, fileName, senderId, mailType, bodyHtmlExtra } = params

  if (to.length === 0) {
    return { success: false, error: 'No recipients specified' }
  }

  const safeIntro = bodyIntro.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
  const maxW = bodyHtmlExtra ? '720px' : '600px'
  const attachmentNote =
    mailType === 'statement'
      ? 'The invoices listed above are included in detail in this email. A PDF statement is also attached.'
      : 'Please find the attached PDF.'
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: ${maxW}; margin: 0 auto;">
      <h2 style="color: #C27E00;">${documentTitle.replace(/</g, '&lt;')}</h2>
      <p>${safeIntro}</p>
      ${bodyHtmlExtra ?? ''}
      <p style="margin-top: 24px; color: #666; font-size: 14px;">${attachmentNote}</p>
      <p style="margin-top: 16px; color: #999; font-size: 12px;">— Aurora Vehicles</p>
    </div>
  `

  const pdfBuffer = Buffer.from(pdfBase64, 'base64')

  const doLog = (success: boolean, errorMessage?: string) => {
    logMailSent({
      recipientEmails: to,
      subject,
      mailType,
      reportTitle: documentTitle,
      senderId,
      success,
      errorMessage,
    })
  }

  const mailSettings = await getMailSettingsWithPassword()
  if (mailSettings) {
    const result = await sendEmailViaSMTP(mailSettings, {
      to,
      subject,
      html: htmlBody,
      attachments: [{ filename: fileName, content: pdfBuffer }],
    })
    doLog(result.success, result.error)
    return result
  }

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
      attachments: [{ filename: fileName, content: pdfBuffer }],
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

export interface BulkInvoicePdfAttachment {
  filename: string
  content: Buffer
}

/** One email with multiple invoice PDF attachments (Aurora Manager bulk send). */
export async function sendBulkInvoicesPdfEmail(params: {
  to: string[]
  subject: string
  documentTitle: string
  bodyIntro: string
  bodyHtmlExtra: string
  attachments: BulkInvoicePdfAttachment[]
  senderId?: string
}): Promise<{ success: boolean; error?: string }> {
  const { to, subject, documentTitle, bodyIntro, bodyHtmlExtra, attachments, senderId } = params
  const n = attachments.length

  if (to.length === 0) {
    return { success: false, error: 'No recipients specified' }
  }
  if (n === 0) {
    return { success: false, error: 'No invoice files to attach' }
  }

  const safeIntro = bodyIntro.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto;">
      <h2 style="color: #C27E00;">${documentTitle.replace(/</g, '&lt;')}</h2>
      <p>${safeIntro}</p>
      ${bodyHtmlExtra}
      <p style="margin-top: 24px; color: #666; font-size: 14px;">${n} invoice PDF file${n !== 1 ? 's are' : ' is'} attached to this message.</p>
      <p style="margin-top: 16px; color: #999; font-size: 12px;">— Aurora Vehicles</p>
    </div>
  `

  const doLog = (success: boolean, errorMessage?: string) => {
    logMailSent({
      recipientEmails: to,
      subject,
      mailType: 'invoice_bulk',
      reportTitle: documentTitle,
      senderId,
      success,
      errorMessage,
    })
  }

  const mailSettings = await getMailSettingsWithPassword()
  if (mailSettings) {
    const result = await sendEmailViaSMTP(mailSettings, {
      to,
      subject,
      html: htmlBody,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })),
    })
    doLog(result.success, result.error)
    return result
  }

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
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
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
    console.error('Bulk invoice email error:', err)
    doLog(false, message)
    return { success: false, error: message }
  }
}
