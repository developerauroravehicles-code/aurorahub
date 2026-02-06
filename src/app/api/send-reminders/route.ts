import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio'
import { getFourHourReminderMessage, isWithin4Hours } from '@/lib/sms-messages'

/**
 * API Route for sending 4-hour reminder SMS
 * This should be called by a cron job or scheduled task
 * Example: Vercel Cron Job that runs every hour
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
    const now = new Date()
    const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000)
    
    const { data: demands, error } = await supabase
      .from('demands')
      .select('id, appointment_date, customer_phone, customer_address, status')
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
          const message = getFourHourReminderMessage(address)
          
          const result = await sendSMS(demand.customer_phone, message)
          
          if (result.success) {
            sentCount++
            console.log(`4-hour reminder sent to ${demand.customer_phone} for appointment ${demand.id}`)
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

