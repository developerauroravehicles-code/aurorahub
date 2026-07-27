import { NextResponse } from 'next/server'
import { formatInTimeZone } from 'date-fns-tz'
import { createAdminClient } from '@/lib/supabase/admin'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { notifyDailyInvoiceMissed, ptTodayDate } from '@/lib/notify-daily-invoice-missed'

/**
 * End-of-day cron: alert Aurora Managers when daily invoices are still unapproved.
 * Runs hourly; executes at 23:00 Pacific Time.
 * Auth: CRON_SECRET (Bearer or ?secret=).
 */
export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const url = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const isAuthorized =
    expectedSecret &&
    (authHeader === `Bearer ${expectedSecret}` || querySecret === expectedSecret)

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = url.searchParams.get('force') === '1'
  const batchDateParam = url.searchParams.get('date')

  const now = new Date()
  const ptHour = formatInTimeZone(now, SYSTEM_DEFAULT_TIMEZONE, 'HH')

  if (!force && ptHour !== '23') {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `Not 23:00 PT (current PT hour: ${ptHour}). Use ?force=1 to run manually.`,
    })
  }

  const supabase = createAdminClient()
  const batchDate = batchDateParam ?? ptTodayDate()
  const result = await notifyDailyInvoiceMissed(supabase, batchDate)

  return NextResponse.json({ ok: true, batchDate, ...result })
}
