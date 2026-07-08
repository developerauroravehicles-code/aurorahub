import type { SupabaseClient } from '@supabase/supabase-js'
import { getInvoicePdfBase64 } from '@/lib/generate-invoice-pdf'
import { sendBulkInvoicesPdfEmail, buildBulkInvoicesSummaryHtml } from '@/lib/email'
import { demandRecordToInvoiceRowData } from '@/lib/invoice-row-pdf-data'
import { getSystemLogo } from '@/lib/get-system-logo'
import type { InvoiceRowData } from '@/lib/generate-invoice-pdf'

const BULK_INVOICE_EMAIL_MAX = 25

const DEMAND_SELECT = `
  id,
  demand_number,
  dealer_id,
  stock_number,
  vin_last6,
  customer_phone,
  customer_firstname,
  customer_lastname,
  customer_address,
  vehicle_year,
  vehicle_make,
  vehicle_model,
  camera_model,
  updated_at,
  completed_at,
  service_type,
  invoice_total_amount,
  invoice_comments,
  invoice_extra_rows,
  invoice_financial_summary,
  invoice_approved_at,
  dealers(name, address, phone, warranty_years)
` as const

function parseExtraEmails(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e && e.includes('@'))
    ),
  ]
}

export type SendDealerDailyBatchOptions = {
  senderId?: string | null
  extraEmailsRaw?: string
  /** When true, only included demands with invoice_approved_at are emailed. */
  approvedOnly?: boolean
  mailType?: string
  /** When true, mark batch as sent on success. */
  markSent?: boolean
}

export async function sendDealerDailyBatchInvoices(
  supabase: SupabaseClient,
  batchId: string,
  options: SendDealerDailyBatchOptions = {}
): Promise<{ success: boolean; error?: string; sentTo?: string[]; invoiceCount?: number }> {
  const {
    senderId,
    extraEmailsRaw,
    approvedOnly = false,
    mailType = 'invoice_bulk',
    markSent = true,
  } = options

  const { data: batch, error: batchError } = await supabase
    .from('dealer_daily_invoice_batches')
    .select('id, dealer_id, batch_date, status, dealers(name)')
    .eq('id', batchId)
    .single()

  if (batchError || !batch) {
    return { success: false, error: batchError?.message ?? 'Batch not found' }
  }

  if (batch.status === 'sent') {
    return { success: false, error: 'Batch already sent.' }
  }

  const { data: dealerEmails } = await supabase
    .from('dealer_invoice_emails')
    .select('email')
    .eq('dealer_id', batch.dealer_id)

  const assigned = (dealerEmails ?? []).map((r) => r.email.trim().toLowerCase()).filter(Boolean)
  const extra = parseExtraEmails(extraEmailsRaw)
  const recipients = [...new Set([...assigned, ...extra])]

  if (recipients.length === 0) {
    return {
      success: false,
      error: 'No recipient emails configured for this dealer.',
    }
  }

  const { data: items } = await supabase
    .from('dealer_daily_invoice_batch_items')
    .select('demand_id, sort_order')
    .eq('batch_id', batchId)
    .eq('included', true)
    .order('sort_order')

  const demandIds = (items ?? []).map((i) => i.demand_id as string)
  if (demandIds.length === 0) {
    return { success: false, error: 'No included invoices to send.' }
  }

  const { data: rows, error: demandsError } = await supabase
    .from('demands')
    .select(DEMAND_SELECT)
    .in('id', demandIds)
    .eq('status', 'completed')

  if (demandsError) return { success: false, error: demandsError.message }

  let eligibleRows = rows ?? []
  if (approvedOnly) {
    eligibleRows = eligibleRows.filter((r) => r.invoice_approved_at != null)
  }

  if (eligibleRows.length === 0) {
    return { success: false, error: approvedOnly ? 'No approved invoices to send.' : 'No invoices to send.' }
  }

  if (eligibleRows.length > BULK_INVOICE_EMAIL_MAX) {
    return {
      success: false,
      error: `At most ${BULK_INVOICE_EMAIL_MAX} invoices per email. Split the batch or exclude some rows.`,
    }
  }

  const rowById = new Map(eligibleRows.map((r) => [r.id as string, r]))
  const ordered = demandIds.map((id) => rowById.get(id)).filter(Boolean) as typeof eligibleRows

  const logoDataUrl = await getSystemLogo()
  const summaryItems: InvoiceRowData[] = []
  const attachments: { filename: string; content: Buffer }[] = []

  for (const row of ordered) {
    const invoiceData = demandRecordToInvoiceRowData(row, logoDataUrl)
    summaryItems.push(invoiceData)
    const { base64, fileName } = getInvoicePdfBase64(invoiceData)
    attachments.push({ filename: fileName, content: Buffer.from(base64, 'base64') })
  }

  const dealerName =
    (Array.isArray(batch.dealers) ? batch.dealers[0]?.name : (batch.dealers as { name?: string } | null)?.name) ??
    'Dealer'
  const batchDate = batch.batch_date as string
  const n = summaryItems.length
  const subject = `Daily invoices — ${dealerName} — ${batchDate} (${n} file${n !== 1 ? 's' : ''})`
  const documentTitle = `Daily invoices — ${dealerName}`
  const bodyIntro = `Daily invoice package for ${dealerName} (${batchDate} PT).`
  const bodyHtmlExtra = buildBulkInvoicesSummaryHtml(summaryItems)

  const result = await sendBulkInvoicesPdfEmail({
    to: recipients,
    subject,
    documentTitle,
    bodyIntro,
    bodyHtmlExtra,
    attachments,
    senderId: senderId ?? undefined,
    mailType,
  })

  if (!result.success) return { success: false, error: result.error ?? 'Failed to send email' }

  if (markSent) {
    await supabase
      .from('dealer_daily_invoice_batches')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by: senderId ?? null,
        auto_send_error: null,
      })
      .eq('id', batchId)
  }

  return { success: true, sentTo: recipients, invoiceCount: n }
}
