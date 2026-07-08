'use server'

import { createClient } from '@/lib/supabase/server'

const MONTH_TO_NUM: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
}

function parseCompleteDateToYYYYMMDD(s: string): string | null {
  const match = s.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/)
  if (match) {
    const [, day, monthName, year] = match
    const m = MONTH_TO_NUM[monthName.toLowerCase()]
    if (m && year && day) return `${year}-${m}-${day.padStart(2, '0')}`
  }
  return null
}
import { revalidatePath } from 'next/cache'
import { buildInvoicePdf, getInvoicePdfBase64 } from '@/lib/generate-invoice-pdf'
import { uploadInvoiceToDrive } from '@/lib/google-drive'
import { sendDocumentPdfEmail, sendBulkInvoicesPdfEmail, buildBulkInvoicesSummaryHtml } from '@/lib/email'
import type { EmailDeliveryOptions } from '@/lib/email'
import { parseEmailComposePayload, type EmailComposePayload } from '@/lib/email-compose'
import type { InvoiceRowData } from '@/lib/generate-invoice-pdf'
import { demandRecordToInvoiceRowData } from '@/lib/invoice-row-pdf-data'
import { getSystemLogo } from '@/lib/get-system-logo'

const BULK_INVOICE_EMAIL_MAX = 25

const INVOICES_LIST_SELECT = `
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
  invoice_saved_at,
  invoice_downloaded_at,
  invoice_drive_uploaded_at,
  dealers(name, address, phone, warranty_years)
` as const

const DEFAULT_FINANCIAL_SUMMARY = {
  gstEnabled: true,
  gstPercent: 5,
  pstEnabled: false,
  pstPercent: 7,
  salesTaxEnabled: false,
  salesTaxPercent: 0,
  otherEnabled: false,
  otherAmount: 0
}

export async function updateInvoiceFields(
  demandId: string,
  invoiceTotalAmount: string | null,
  invoiceComments: string | null,
  extraRows?: { col1: string; col2: string }[],
  financialSummary?: typeof DEFAULT_FINANCIAL_SUMMARY
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can update invoice fields' }
  }

  const numVal = invoiceTotalAmount?.trim()
  const updateData: {
    invoice_total_amount?: number | null
    invoice_comments?: string | null
    invoice_extra_rows?: { col1: string; col2: string }[]
    invoice_financial_summary?: typeof DEFAULT_FINANCIAL_SUMMARY
    invoice_saved_at?: string
  } = {}
  if (numVal !== undefined && numVal !== '') {
    const parsed = parseFloat(numVal.replace(/[^0-9.-]/g, ''))
    updateData.invoice_total_amount = isNaN(parsed) ? null : parsed
  } else {
    updateData.invoice_total_amount = null
  }
  updateData.invoice_comments = invoiceComments?.trim() || null
  if (extraRows !== undefined) {
    const filtered = extraRows.filter(r => r.col1.trim() !== '' || r.col2.trim() !== '')
    updateData.invoice_extra_rows = filtered.length > 0 ? filtered : []
  }
  if (financialSummary !== undefined) {
    updateData.invoice_financial_summary = financialSummary
  }
  updateData.invoice_saved_at = new Date().toISOString()

  const { error } = await supabase
    .from('demands')
    .update(updateData)
    .eq('id', demandId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/invoices')
  revalidatePath(`/dashboard/admin/invoices/${demandId}`)
  revalidatePath('/dashboard/admin/daily-invoices')
  return { success: true }
}

export async function recordInvoiceDownloadAction(demandId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, dealer_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('demands')
    .update({ invoice_downloaded_at: new Date().toISOString() })
    .eq('id', demandId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/invoices')
  return {}
}

export async function updateInvoiceStatusAction(
  demandId: string,
  updates: {
    invoice_saved_at?: boolean
    invoice_downloaded_at?: boolean
    invoice_drive_uploaded_at?: boolean
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Unauthorized' }
  }

  const updateData: Record<string, string | null> = {}
  if (updates.invoice_saved_at !== undefined) {
    updateData.invoice_saved_at = updates.invoice_saved_at ? new Date().toISOString() : null
  }
  if (updates.invoice_downloaded_at !== undefined) {
    updateData.invoice_downloaded_at = updates.invoice_downloaded_at ? new Date().toISOString() : null
  }
  if (updates.invoice_drive_uploaded_at !== undefined) {
    updateData.invoice_drive_uploaded_at = updates.invoice_drive_uploaded_at ? new Date().toISOString() : null
  }

  if (Object.keys(updateData).length === 0) return {}

  const { error } = await supabase
    .from('demands')
    .update(updateData)
    .eq('id', demandId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/invoices')
  revalidatePath(`/dashboard/admin/invoices/${demandId}`)
  revalidatePath('/dashboard/admin/daily-invoices')
  return {}
}

export async function approveInvoiceAction(
  demandId: string,
  approved: boolean
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can approve invoices' }
  }

  const { error } = await supabase
    .from('demands')
    .update({
      invoice_approved_at: approved ? new Date().toISOString() : null,
      invoice_approved_by: approved ? user.id : null,
    })
    .eq('id', demandId)
    .eq('status', 'completed')

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/invoices')
  revalidatePath(`/dashboard/admin/invoices/${demandId}`)
  revalidatePath('/dashboard/admin/daily-invoices')
  return { success: true }
}

export async function uploadInvoiceToDriveAction(
  invoiceData: InvoiceRowData,
  dealerName: string,
  demandId: string
): Promise<{ success: true; fileId: string; webViewLink?: string } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Manager can upload to Drive' }
  }

  const { data: settingsRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'google_drive_settings')
    .single()

  if (!settingsRow?.value) {
    return { success: false, error: 'Google Drive not configured. Configure in Integrations > External APIs.' }
  }

  const settings = JSON.parse(settingsRow.value) as Parameters<typeof uploadInvoiceToDrive>[3]
  if (!settings.enabled) {
    return { success: false, error: 'Google Drive integration is disabled' }
  }

  const doc = buildInvoicePdf(invoiceData)
  const buffer = doc.output('arraybuffer') as ArrayBuffer
  // Parse completeDate (e.g. "4 March 2026") for filename - from string to avoid timezone shift
  let dateStr = new Date().toISOString().slice(0, 10)
  const cd = invoiceData.completeDate?.trim()
  if (cd) {
    const parsed = parseCompleteDateToYYYYMMDD(cd)
    if (parsed) dateStr = parsed
  }
  const fileName = `Invoice_${invoiceData.demand_number ?? 'invoice'}_${dateStr}.pdf`
  const pdfBuffer = Buffer.from(buffer)

  const { data: demand } = await supabase
    .from('demands')
    .select('invoice_drive_file_id')
    .eq('id', demandId)
    .single()

  const existingFileId = demand?.invoice_drive_file_id ?? null

  const result = await uploadInvoiceToDrive(
    pdfBuffer,
    fileName,
    dealerName || 'Unknown Dealer',
    settings,
    invoiceData.completeDate,
    existingFileId
  )

  if (result.success) {
    await supabase
      .from('demands')
      .update({
        invoice_drive_uploaded_at: new Date().toISOString(),
        invoice_drive_file_id: result.fileId
      })
      .eq('id', demandId)
    revalidatePath('/dashboard/admin/invoices')
  }

  return result
}

export async function sendInvoicePdfEmailAction(
  invoiceData: InvoiceRowData,
  composePayload: EmailComposePayload
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can email invoices' }
  }

  const { parsed, error: parseError } = parseEmailComposePayload(composePayload)
  if (!parsed) return { error: parseError ?? 'Invalid email' }

  const { base64, fileName } = getInvoicePdfBase64(invoiceData)
  const invLabel = invoiceData.demand_number ? `#${invoiceData.demand_number}` : 'Invoice'
  const defaultSubject = `Invoice ${invLabel} — Aurora Vehicles`
  const documentTitle = `Invoice ${invLabel}`
  const bodyIntro = `Please find attached the invoice for ${invoiceData.customerName} (${invLabel}).`

  const compose: EmailDeliveryOptions = {
    cc: parsed.cc,
    bcc: parsed.bcc,
    subject: parsed.subject,
    bodyHtml: parsed.bodyHtml,
    extraAttachments: parsed.extraAttachments,
  }

  const result = await sendDocumentPdfEmail({
    to: parsed.to,
    subject: defaultSubject,
    documentTitle,
    bodyIntro,
    pdfBase64: base64,
    fileName,
    senderId: user.id,
    mailType: 'invoice',
    compose,
  })

  if (!result.success) return { error: result.error ?? 'Failed to send email' }
  return { success: true }
}

export async function sendBulkInvoicePdfEmailAction(
  demandIds: string[],
  composePayload: EmailComposePayload
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can email invoices' }
  }

  const uniqueIds = [...new Set(demandIds.map((id) => id.trim()).filter(Boolean))]
  if (uniqueIds.length === 0) return { error: 'No invoices selected' }
  if (uniqueIds.length > BULK_INVOICE_EMAIL_MAX) {
    return { error: `Select at most ${BULK_INVOICE_EMAIL_MAX} invoices per email` }
  }

  const { parsed, error: parseError } = parseEmailComposePayload(composePayload)
  if (!parsed) return { error: parseError ?? 'Invalid email' }

  const { data: rows, error } = await supabase
    .from('demands')
    .select(INVOICES_LIST_SELECT)
    .in('id', uniqueIds)
    .eq('status', 'completed')

  if (error) return { error: error.message }
  if (!rows || rows.length !== uniqueIds.length) {
    return { error: 'One or more invoices are missing or not completed' }
  }

  const rowById = new Map(rows.map((r) => [r.id as string, r]))
  const ordered = uniqueIds.map((id) => rowById.get(id)!)

  const logoDataUrl = await getSystemLogo()
  const summaryItems: InvoiceRowData[] = []
  const attachments: { filename: string; content: Buffer }[] = []

  for (const row of ordered) {
    const invoiceData = demandRecordToInvoiceRowData(row, logoDataUrl)
    summaryItems.push(invoiceData)
    const { base64, fileName } = getInvoicePdfBase64(invoiceData)
    attachments.push({ filename: fileName, content: Buffer.from(base64, 'base64') })
  }

  const n = summaryItems.length
  const defaultSubject =
    n === 1 && summaryItems[0]?.demand_number
      ? `Invoice #${summaryItems[0].demand_number} — Aurora Vehicles`
      : `${n} invoices — Aurora Vehicles`
  const documentTitle = n === 1 ? `Invoice ${summaryItems[0]?.demand_number ? `#${summaryItems[0].demand_number}` : ''}`.trim() : `Bulk invoices (${n})`
  const bodyIntro =
    n === 1
      ? `Please find attached the invoice for ${summaryItems[0].customerName}.`
      : 'Please find attached the invoice PDFs for the selected completed demands.'

  const compose: EmailDeliveryOptions = {
    cc: parsed.cc,
    bcc: parsed.bcc,
    subject: parsed.subject,
    bodyHtml: parsed.bodyHtml,
    extraAttachments: parsed.extraAttachments,
  }

  const result = await sendBulkInvoicesPdfEmail({
    to: parsed.to,
    subject: defaultSubject,
    documentTitle,
    bodyIntro,
    bodyHtmlExtra: buildBulkInvoicesSummaryHtml(summaryItems),
    attachments,
    senderId: user.id,
    compose,
  })

  if (!result.success) return { error: result.error ?? 'Failed to send email' }
  return { success: true }
}
