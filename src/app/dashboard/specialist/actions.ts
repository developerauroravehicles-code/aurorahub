'use server'

import { createClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio'
import { format } from 'date-fns'

export async function sendAppointmentReminderSMS(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is specialist
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, phone')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'specialist') {
    return { error: 'Only specialists can send appointment reminders' }
  }

  // Get demand details
  const { data: demand } = await supabase
    .from('demands')
    .select('appointment_date, customer_address, assigned_specialist_id')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }
  
  if (demand.assigned_specialist_id !== user.id) {
    return { error: 'This demand is not assigned to you' }
  }

  // Format the appointment date (same format as customer SMS)
  const appointmentDate = new Date(demand.appointment_date)
  const formattedDate = format(appointmentDate, 'MMMM dd, yyyy \'at\' HH:mm')
  
  // Create the SMS message (same as customer SMS)
  const message = `An appointment has been created for ${formattedDate} at ${demand.customer_address || 'the specified location'}. Aurora Vehicles.`
  
  // Send SMS to specialist
  if (profile.phone) {
    try {
      const result = await sendSMS(profile.phone, message)
      if (result.success) {
        return { success: true }
      } else {
        return { error: 'Failed to send SMS' }
      }
    } catch (error) {
      console.error('Failed to send SMS to specialist:', error)
      return { error: 'Failed to send SMS' }
    }
  } else {
    return { error: 'Specialist phone number not found' }
  }
}

