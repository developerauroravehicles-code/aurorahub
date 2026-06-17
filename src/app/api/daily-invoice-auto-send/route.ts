import { NextResponse } from 'next/server'
import { formatInTimeZone } from 'date-fns-tz'
import { createAdminClient } from '@/lib/supabase/admin'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { runDailyInvoiceAutoSend } from '@/lib/daily-invoice-auto-send'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const ptHour = formatInTimeZone(now, SYSTEM_DEFAULT_TIMEZONE, 'HH')
  const ptMinute = formatInTimeZone(now, SYSTEM_DEFAULT_TIMEZONE, 'mm')

  if (ptHour !== '08' || ptMinute !== '30') {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `Not 08:30 PT (current PT time: ${ptHour}:${ptMinute})`,
    })
  }

  const supabase = createAdminClient()
  const result = await runDailyInvoiceAutoSend(supabase)

  return NextResponse.json({ ok: true, ...result })
}
