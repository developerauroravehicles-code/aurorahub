'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendDealerDailyBatchInvoices } from '@/lib/send-dealer-daily-batch-invoices'

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

  const result = await sendDealerDailyBatchInvoices(auth.supabase, batchId, {
    senderId: auth.userId,
    extraEmailsRaw,
    mailType: 'invoice_bulk',
  })

  if (!result.success) return { error: result.error ?? 'Failed to send email' }

  revalidatePath('/dashboard/admin/daily-invoices')
  return { success: true, sentTo: result.sentTo }
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
