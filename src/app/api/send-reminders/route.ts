import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio'
import { getFourHourReminderMessage, isWithin4Hours } from '@/lib/sms-messages'

/**
 * API Route for sending reminder SMS
 * This should be called by a cron job or scheduled task
 * Runs daily at 6 AM (Vercel Hobby plan: 1 cron job per day)
 * Sends SMS reminders to all appointments that are within 4 hours at the time of execution
 * SMS message dynamically shows the actual hours remaining until the appointment
 */
export async function GET(request: Request) {
  // Optional: Add authentication/authorization check
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    
    // Get all approved demands with appointments in the next 4 hours
    // When running daily at 6 AM, this will get appointments between 6 AM and 10 AM
    // The isWithin4Hours check ensures we only send SMS to appointments actually within 4 hours
    // SMS message will dynamically show the actual hours remaining (e.g., "7 hours", "4 hours", "2 hours", "1 hour")
    const now = new Date()
    const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000)
    
    const { data: demands, error } = await supabase
      .from('demands')
      .select('id, appointment_date, customer_phone, customer_address, status, dealer_id, dealers(region_codes(timezone_id, timezones(name)))')
      .eq('status', 'approved')
      .gte('appointment_date', now.toISOString())
      .lte('appointment_date', fourHoursFromNow.toISOString())
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

    // Send SMS for each demand that is within 4 hours
    for (const demand of demands) {
      const appointmentDate = new Date(demand.appointment_date)
      
      // Double-check if it's within 4 hours (to avoid sending too early)
      if (isWithin4Hours(appointmentDate) && demand.customer_phone) {
        try {
          const address = demand.customer_address || 'the specified location'
          // Get timezone from dealer > region > timezone
          const timezoneName = (demand.dealers as any)?.region_codes?.timezones?.name || undefined
          // Pass appointmentDate to calculate dynamic hours remaining
          const message = getFourHourReminderMessage(appointmentDate, address, timezoneName)
          
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

