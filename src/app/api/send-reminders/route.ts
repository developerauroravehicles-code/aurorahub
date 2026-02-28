import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/twilio'
import { isWithinHoursBeforeWindow } from '@/lib/sms-messages'
import { getSmsSettings } from '@/lib/sms-resolver'
import { resolveReminderTemplate } from '@/lib/sms-resolver'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { logSmsSent } from '@/lib/sms-logger'
import { getReminderAutomationConfig } from '@/lib/automation-settings'

/**
 * API Route for sending reminder SMS
 * Called by cron every hour at the top of the hour.
 * Sends reminder X hours before each appointment (X from Automation settings: 2, 4, or 6).
 * Candidates: approved appointments in the next 0–7h; send only if in X-0.5h to X+0.5h window.
 * Requires CRON_SECRET in env; Vercel sends it as Authorization: Bearer <secret>.
 * Query param ?secret=<CRON_SECRET> also accepted for external cron services.
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
    return NextResponse.json(
      { error: 'Unauthorized. Set CRON_SECRET in Vercel env vars.' },
      { status: 401 }
    )
  }

  try {
    const supabase = createAdminClient()
    const reminderConfig = await getReminderAutomationConfig(supabase)
    if (!reminderConfig.enabled) {
      return NextResponse.json({
        success: true,
        message: 'Reminder automation is disabled',
        sent: 0,
        errors: 0,
      })
    }

    const now = new Date()
    const sevenHoursFromNow = new Date(now.getTime() + 7 * 60 * 60 * 1000)

    // Fetch approved appointments in the next 7 hours that haven't received reminder yet
    const { data: demands, error } = await supabase
      .from('demands')
      .select('id, appointment_date, customer_phone, customer_firstname, customer_lastname, customer_address, status, dealer_id, assigned_specialist_id, reminder_sent_at, dealers(region_codes(timezone_id, timezones(name)))')
      .eq('status', 'approved')
      .gte('appointment_date', now.toISOString())
      .lte('appointment_date', sevenHoursFromNow.toISOString())
      .is('reminder_sent_at', null)
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

      // Only send if we're in the configurable hours-before window (e.g. 3.5h–4.5h for 4h)
      if (!isWithinHoursBeforeWindow(appointmentDate, reminderConfig.hoursBefore)) continue

      if (!reminderConfig.sendToCustomer && !reminderConfig.sendToSpecialist) continue

      const smsSettings = await getSmsSettings(supabase)
      const rh = smsSettings.four_hour_reminder

      const hoursText = reminderConfig.hoursBefore === 1 ? '1 hour' : `${reminderConfig.hoursBefore} hours`
      const address = demand.customer_address || 'the specified location'
      const message = resolveReminderTemplate(rh.template, {
        hoursText,
        address,
        signature: smsSettings.signature,
      })

      let sentForThisDemand = false

      // Send to customer (same message as specialist)
      if (reminderConfig.sendToCustomer && demand.customer_phone) {
        try {
          const result = await sendSMS(demand.customer_phone, message)
          if (result.success) {
            sentCount++
            sentForThisDemand = true
            logSmsSent({
              phoneNumber: demand.customer_phone,
              recipientType: 'customer',
              recipientName: `${(demand as { customer_firstname?: string }).customer_firstname} ${(demand as { customer_lastname?: string }).customer_lastname}`.trim(),
              demandId: demand.id,
              messageType: 'four_hour_reminder',
              triggeredBy: 'system',
              messageContent: message,
            }, supabase).catch(() => {})
            console.log(`Reminder sent to customer ${demand.customer_phone} for appointment ${demand.id}`)
          } else {
            errorCount++
            console.error(`Failed to send reminder to customer ${demand.customer_phone} for appointment ${demand.id}`)
          }
        } catch (error) {
          errorCount++
          console.error(`Error sending reminder to customer for appointment ${demand.id}:`, error)
        }
      }

      // Send to assigned specialist (same message, same time)
      if (reminderConfig.sendToSpecialist && (demand as { assigned_specialist_id?: string }).assigned_specialist_id) {
        try {
          const { data: specialist } = await supabase
            .from('profiles')
            .select('phone, full_name')
            .eq('id', (demand as { assigned_specialist_id?: string }).assigned_specialist_id)
            .single()
          if (specialist?.phone) {
            const result = await sendSMS(specialist.phone, message)
            if (result.success) {
              sentCount++
              sentForThisDemand = true
              logSmsSent({
                phoneNumber: specialist.phone,
                recipientType: 'specialist',
                recipientName: specialist.full_name ?? undefined,
                demandId: demand.id,
                messageType: 'four_hour_reminder',
                triggeredBy: 'system',
                messageContent: message,
              }, supabase).catch(() => {})
              console.log(`Reminder sent to specialist ${specialist.phone} for appointment ${demand.id}`)
            } else {
              errorCount++
              console.error(`Failed to send reminder to specialist ${specialist.phone} for appointment ${demand.id}`)
            }
          }
        } catch (error) {
          errorCount++
          console.error(`Error sending reminder to specialist for appointment ${demand.id}:`, error)
        }
      }

      // Mark reminder sent to prevent duplicates (only if we successfully sent to at least one recipient)
      if (sentForThisDemand) {
        await supabase
          .from('demands')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', demand.id)
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

