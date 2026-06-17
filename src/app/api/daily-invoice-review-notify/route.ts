import { NextResponse } from 'next/server'
import { formatInTimeZone } from 'date-fns-tz'
import { createAdminClient } from '@/lib/supabase/admin'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { notifyDailyInvoiceReview, ptTodayDate } from '@/lib/notify-daily-invoice-review'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const ptHour = formatInTimeZone(now, SYSTEM_DEFAULT_TIMEZONE, 'HH')

  if (ptHour !== '21') {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `Not 21:00 PT (current PT hour: ${ptHour})`,
    })
  }

  const batchDate = ptTodayDate()
  const supabase = createAdminClient()

  const result = await notifyDailyInvoiceReview(supabase, batchDate)

  return NextResponse.json({
    ok: true,
    batchDate,
    ...result,
  })
}
