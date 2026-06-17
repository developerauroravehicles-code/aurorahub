import type { SupabaseClient } from '@supabase/supabase-js'
import { subDays } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { ptTodayDate } from '@/lib/daily-dealer-invoices'
import { sendDealerDailyBatchInvoices } from '@/lib/send-dealer-daily-batch-invoices'

export function ptYesterdayDate(): string {
  const zonedNow = toZonedTime(new Date(), SYSTEM_DEFAULT_TIMEZONE)
  const yesterday = subDays(zonedNow, 1)
  return formatInTimeZone(yesterday, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
}

async function notifyAutoSendFailure(
  supabase: SupabaseClient,
  dealerName: string,
  batchDate: string,
  batchId: string,
  errorMessage: string
): Promise<number> {
  const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'aurora_manager')
  if (!managers?.length) return 0

  const message = `${dealerName}'s daily invoices dont delivered. Contant with IT.`
  const link = `/dashboard/admin/daily-invoices?date=${batchDate}`

  await supabase.from('comm_notifications').insert(
    managers.map((m: { id: string }) => ({
      user_id: m.id,
      type: 'daily_invoice_send_failed' as const,
      payload: {
        dealerName,
        batchDate,
        batchId,
        link,
        message,
        error: errorMessage,
      },
    }))
  )

  return managers.length
}

export type DailyInvoiceAutoSendResult = {
  batchDate: string
  attempted: number
  sent: number
  failed: number
  skipped: number
  details: Array<{ batchId: string; dealerName: string; status: 'sent' | 'failed' | 'skipped'; reason?: string }>
}

/**
 * Send approved daily invoice batches for the previous PT calendar day.
 * Called from cron at 08:30 PT.
 */
export async function runDailyInvoiceAutoSend(
  supabase: SupabaseClient,
  batchDate?: string
): Promise<DailyInvoiceAutoSendResult> {
  const targetDate = batchDate ?? ptYesterdayDate()

  const { data: batches } = await supabase
    .from('dealer_daily_invoice_batches')
    .select('id, dealer_id, batch_date, status, dealers(name)')
    .eq('batch_date', targetDate)
    .neq('status', 'sent')

  const result: DailyInvoiceAutoSendResult = {
    batchDate: targetDate,
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    details: [],
  }

  if (!batches?.length) return result

  for (const batch of batches) {
    const batchId = batch.id as string
    const dealerName =
      (Array.isArray(batch.dealers) ? batch.dealers[0]?.name : (batch.dealers as { name?: string } | null)?.name) ??
      'Dealer'

    const { data: items } = await supabase
      .from('dealer_daily_invoice_batch_items')
      .select('demand_id')
      .eq('batch_id', batchId)
      .eq('included', true)

    const demandIds = (items ?? []).map((i) => i.demand_id as string)
    if (demandIds.length === 0) {
      result.skipped++
      result.details.push({ batchId, dealerName, status: 'skipped', reason: 'No included items' })
      continue
    }

    const { data: approvedDemands } = await supabase
      .from('demands')
      .select('id')
      .in('id', demandIds)
      .not('invoice_approved_at', 'is', null)

    if (!approvedDemands?.length) {
      result.skipped++
      result.details.push({ batchId, dealerName, status: 'skipped', reason: 'No approved invoices' })
      continue
    }

    result.attempted++
    const attemptedAt = new Date().toISOString()

    const sendResult = await sendDealerDailyBatchInvoices(supabase, batchId, {
      approvedOnly: true,
      mailType: 'daily_dealer_invoices_auto',
      markSent: true,
      senderId: null,
    })

    if (sendResult.success) {
      result.sent++
      await supabase
        .from('dealer_daily_invoice_batches')
        .update({ auto_send_attempted_at: attemptedAt, auto_send_error: null })
        .eq('id', batchId)
      result.details.push({ batchId, dealerName, status: 'sent' })
      continue
    }

    result.failed++
    const err = sendResult.error ?? 'Unknown error'
    await supabase
      .from('dealer_daily_invoice_batches')
      .update({ auto_send_attempted_at: attemptedAt, auto_send_error: err })
      .eq('id', batchId)

    await notifyAutoSendFailure(supabase, dealerName, targetDate, batchId, err)
    result.details.push({ batchId, dealerName, status: 'failed', reason: err })
  }

  return result
}

export { ptTodayDate }
