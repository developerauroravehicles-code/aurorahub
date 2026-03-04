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
import { buildInvoicePdf } from '@/lib/generate-invoice-pdf'
import { uploadInvoiceToDrive } from '@/lib/google-drive'
import type { InvoiceRowData } from '@/lib/generate-invoice-pdf'

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

  const { error } = await supabase
    .from('demands')
    .update(updateData)
    .eq('id', demandId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/invoices')
  return { success: true }
}

export async function uploadInvoiceToDriveAction(
  invoiceData: InvoiceRowData,
  dealerName: string
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
    return { success: false, error: 'Google Drive not configured. Configure in System Management > API.' }
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

  return uploadInvoiceToDrive(
    pdfBuffer,
    fileName,
    dealerName || 'Unknown Dealer',
    settings,
    invoiceData.completeDate
  )
}
