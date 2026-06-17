import type { SupabaseClient } from '@supabase/supabase-js'
import { ptTodayDate } from '@/lib/daily-dealer-invoices'

/**
 * Notify all aurora_manager users that today's daily invoice batches are ready for review.
 * Called from cron at 21:00 PT (once per batch_date per day).
 */
export async function notifyDailyInvoiceReview(
  supabase: SupabaseClient,
  batchDate: string
): Promise<{ notified: number; dealerCount: number }> {
  const { data: batches } = await supabase
    .from('dealer_daily_invoice_batches')
    .select('id, dealer_id, review_notified_at')
    .eq('batch_date', batchDate)
    .is('review_notified_at', null)

  if (!batches?.length) {
    return { notified: 0, dealerCount: 0 }
  }

  const batchIds = batches.map((b) => b.id)
  const { data: items } = await supabase
    .from('dealer_daily_invoice_batch_items')
    .select('batch_id')
    .in('batch_id', batchIds)

  const batchesWithItems = new Set((items ?? []).map((i) => i.batch_id as string))
  const eligible = batches.filter((b) => batchesWithItems.has(b.id))

  if (eligible.length === 0) {
    return { notified: 0, dealerCount: 0 }
  }

  const { data: managers } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'aurora_manager')

  if (!managers?.length) {
    return { notified: 0, dealerCount: eligible.length }
  }

  const link = `/dashboard/admin/daily-invoices?date=${batchDate}`
  const payload = {
    batchDate,
    dealerCount: eligible.length,
    link,
    message: `${eligible.length} dealer invoice list(s) ready for review (${batchDate} PT).`,
  }

  await supabase.from('comm_notifications').insert(
    managers.map((m: { id: string }) => ({
      user_id: m.id,
      type: 'daily_invoice_review' as const,
      payload,
    }))
  )

  const now = new Date().toISOString()
  await supabase
    .from('dealer_daily_invoice_batches')
    .update({ review_notified_at: now })
    .in(
      'id',
      eligible.map((b) => b.id)
    )

  return { notified: managers.length, dealerCount: eligible.length }
}

export { ptTodayDate }
