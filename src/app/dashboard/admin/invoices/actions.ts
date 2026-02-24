'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { buildInvoicePdf } from '@/lib/generate-invoice-pdf'
import { uploadInvoiceToDrive } from '@/lib/google-drive'
import type { InvoiceRowData } from '@/lib/generate-invoice-pdf'

export async function updateInvoiceFields(
  demandId: string,
  invoiceTotalAmount: string | null,
  invoiceComments: string | null
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
  const updateData: { invoice_total_amount?: number | null; invoice_comments?: string | null } = {}
  if (numVal !== undefined && numVal !== '') {
    const parsed = parseFloat(numVal.replace(/[^0-9.-]/g, ''))
    updateData.invoice_total_amount = isNaN(parsed) ? null : parsed
  } else {
    updateData.invoice_total_amount = null
  }
  updateData.invoice_comments = invoiceComments?.trim() || null

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
  const fileName = `Invoice_${invoiceData.demand_number ?? 'invoice'}_${new Date().toISOString().slice(0, 10)}.pdf`
  const pdfBuffer = Buffer.from(buffer)

  return uploadInvoiceToDrive(pdfBuffer, fileName, dealerName || 'Unknown Dealer', settings)
}
