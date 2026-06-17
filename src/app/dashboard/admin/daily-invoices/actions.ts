'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getInvoicePdfBase64 } from '@/lib/generate-invoice-pdf'
import { sendBulkInvoicesPdfEmail, buildBulkInvoicesSummaryHtml } from '@/lib/email'
import { demandRecordToInvoiceRowData } from '@/lib/invoice-row-pdf-data'
import { getSystemLogo } from '@/app/dashboard/system-management/logo/actions'
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
  dealers(name, address, phone)
` as const

async function verifyAuroraManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, supabase: null, userId: null }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can manage daily invoices' as const, supabase: null, userId: null }
  }

  return { error: null, supabase, userId: user.id }
}

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

export async function setBatchItemIncluded(
  batchId: string,
  demandId: string,
  included: boolean
): Promise<{ error?: string; success?: boolean }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const { error } = await auth.supabase
    .from('dealer_daily_invoice_batch_items')
    .update({ included })
    .eq('batch_id', batchId)
    .eq('demand_id', demandId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/daily-invoices')
  return { success: true }
}

export async function sendDailyDealerInvoices(
  batchId: string,
  extraEmailsRaw?: string
): Promise<{ error?: string; success?: boolean; sentTo?: string[] }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.supabase || !auth.userId) return { error: auth.error ?? 'Unauthorized' }

  const { data: batch, error: batchError } = await auth.supabase
    .from('dealer_daily_invoice_batches')
    .select('id, dealer_id, batch_date, status, dealers(name)')
    .eq('id', batchId)
    .single()

  if (batchError || !batch) return { error: batchError?.message ?? 'Batch not found' }

  const { data: dealerEmails } = await auth.supabase
    .from('dealer_invoice_emails')
    .select('email')
    .eq('dealer_id', batch.dealer_id)

  const assigned = (dealerEmails ?? []).map((r) => r.email.trim().toLowerCase()).filter(Boolean)
  const extra = parseExtraEmails(extraEmailsRaw)
  const recipients = [...new Set([...assigned, ...extra])]

  if (recipients.length === 0) {
    return {
      error: 'No recipient emails. Configure invoice emails for this dealer in Configuration → Dealers.',
    }
  }

  const { data: items } = await auth.supabase
    .from('dealer_daily_invoice_batch_items')
    .select('demand_id, sort_order')
    .eq('batch_id', batchId)
    .eq('included', true)
    .order('sort_order')

  const demandIds = (items ?? []).map((i) => i.demand_id as string)
  if (demandIds.length === 0) {
    return { error: 'No included invoices to send.' }
  }
  if (demandIds.length > BULK_INVOICE_EMAIL_MAX) {
    return { error: `At most ${BULK_INVOICE_EMAIL_MAX} invoices per email. Split the batch or exclude some rows.` }
  }

  const { data: rows, error: demandsError } = await auth.supabase
    .from('demands')
    .select(DEMAND_SELECT)
    .in('id', demandIds)
    .eq('status', 'completed')

  if (demandsError) return { error: demandsError.message }
  if (!rows || rows.length !== demandIds.length) {
    return { error: 'One or more invoices are missing or not completed.' }
  }

  const rowById = new Map(rows.map((r) => [r.id as string, r]))
  const ordered = demandIds.map((id) => rowById.get(id)!)

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
  const bodyIntro = `<p>Daily invoice package for <strong>${dealerName}</strong> (${batchDate} PT).</p>`
  const bodyHtmlExtra = buildBulkInvoicesSummaryHtml(summaryItems)

  const result = await sendBulkInvoicesPdfEmail({
    to: recipients,
    subject,
    documentTitle,
    bodyIntro,
    bodyHtmlExtra,
    attachments,
    senderId: auth.userId,
  })

  if (!result.success) return { error: result.error ?? 'Failed to send email' }

  await auth.supabase
    .from('dealer_daily_invoice_batches')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by: auth.userId,
    })
    .eq('id', batchId)

  revalidatePath('/dashboard/admin/daily-invoices')
  return { success: true, sentTo: recipients }
}

export async function updateDailyInvoiceDemandFields(
  demandId: string,
  invoiceTotalAmount: string | null,
  invoiceComments: string | null
): Promise<{ error?: string; success?: boolean }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const numVal = invoiceTotalAmount?.trim()
  const updateData: { invoice_total_amount?: number | null; invoice_comments?: string | null; invoice_saved_at?: string } =
    {}
  if (numVal !== undefined && numVal !== '') {
    const parsed = parseFloat(numVal.replace(/[^0-9.-]/g, ''))
    updateData.invoice_total_amount = Number.isNaN(parsed) ? null : parsed
  } else {
    updateData.invoice_total_amount = null
  }
  updateData.invoice_comments = invoiceComments?.trim() || null
  updateData.invoice_saved_at = new Date().toISOString()

  const { error } = await auth.supabase.from('demands').update(updateData).eq('id', demandId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/daily-invoices')
  revalidatePath('/dashboard/admin/invoices')
  return { success: true }
}
