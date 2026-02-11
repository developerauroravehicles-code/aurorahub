import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio'
import { getFourHourReminderMessage, isWithin4HoursBeforeWindow } from '@/lib/sms-messages'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'

/**
 * API Route for sending reminder SMS
 * Called by cron every hour at the top of the hour.
 * Sends reminder exactly ~4 hours before each appointment in dealer local time
 * (e.g. 11:00 dealer time → send when it's ~07:00 dealer time).
 * Candidates: approved appointments in the next 0–6h; send only if 3.5h–4.5h before (by dealer time).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const now = new Date()
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000)

    // Fetch approved appointments in the next 6 hours (candidates); actual "4h before" is decided per dealer time below
    const { data: demands, error } = await supabase
      .from('demands')
      .select('id, appointment_date, customer_phone, customer_address, status, dealer_id, dealers(region_codes(timezone_id, timezones(name)))')
      .eq('status', 'approved')
      .gte('appointment_date', now.toISOString())
      .lte('appointment_date', sixHoursFromNow.toISOString())
      .not('customer_phone', 'is', null)

    if (error) {
      console.error('Error fetching demands:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!demands || demands.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No appointments requiring reminders',
        sent: 0
      })
    }

    let sentCount = 0
    let errorCount = 0

    for (const demand of demands) {
      const appointmentDate = new Date(demand.appointment_date)
      const timezoneName = getTimezoneFromDealer(demand.dealers as Parameters<typeof getTimezoneFromDealer>[0]) ?? null

      // Only send if we're in the 3.5h–4.5h-before window (same in any TZ; dealer TZ used for consistency)
      if (!isWithin4HoursBeforeWindow(appointmentDate, timezoneName) || !demand.customer_phone) continue

      try {
        const address = demand.customer_address || 'the specified location'
        const message = getFourHourReminderMessage(appointmentDate, address, timezoneName ?? undefined, true)
        const result = await sendSMS(demand.customer_phone, message)

        if (result.success) {
          sentCount++
          console.log(`Reminder sent to ${demand.customer_phone} for appointment ${demand.id}`)
        } else {
          errorCount++
          console.error(`Failed to send reminder to ${demand.customer_phone} for appointment ${demand.id}`)
        }
      } catch (error) {
        errorCount++
        console.error(`Error sending reminder for appointment ${demand.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reminders processed: ${sentCount} sent, ${errorCount} errors`,
      sent: sentCount,
      errors: errorCount,
      total: demands.length
    })
  } catch (error) {
    console.error('Error in send-reminders route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

