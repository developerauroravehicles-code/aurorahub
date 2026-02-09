import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio'
import { getFourHourReminderMessage, isWithin4HoursBeforeWindow } from '@/lib/sms-messages'

/**
 * API Route for sending reminder SMS
 * Called by cron every hour at the top of the hour.
 * Sends reminder exactly ~4 hours before each appointment (e.g. 11:00 appointment → 07:00).
 * Only appointments in the 3.5h–4.5h window are sent so each appointment gets one reminder.
 */
export async function GET(request: Request) {
  // Optional: Add authentication/authorization check
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    
    // Appointments that are ~4 hours from now (window 3.5h–4.5h) so we send exactly 4h before (e.g. 07:00 → 11:00)
    const now = new Date()
    const threeAndHalfHoursFromNow = new Date(now.getTime() + 3.5 * 60 * 60 * 1000)
    const fourAndHalfHoursFromNow = new Date(now.getTime() + 4.5 * 60 * 60 * 1000)
    
    const { data: demands, error } = await supabase
      .from('demands')
      .select('id, appointment_date, customer_phone, customer_address, status, dealer_id, dealers(region_codes(timezone_id, timezones(name)))')
      .eq('status', 'approved')
      .gte('appointment_date', threeAndHalfHoursFromNow.toISOString())
      .lte('appointment_date', fourAndHalfHoursFromNow.toISOString())
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

    // Send SMS only for appointments in the 4-hours-before window
    for (const demand of demands) {
      const appointmentDate = new Date(demand.appointment_date)
      
      if (isWithin4HoursBeforeWindow(appointmentDate) && demand.customer_phone) {
        try {
          const address = demand.customer_address || 'the specified location'
          // Get timezone from dealer > region > timezone
          const timezoneName = (demand.dealers as any)?.region_codes?.timezones?.name || undefined
          // Pass appointmentDate to calculate dynamic hours remaining
          const message = getFourHourReminderMessage(appointmentDate, address, timezoneName, true)
          
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

