'use server'

import { createClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio'
import { logSmsSent } from '@/lib/sms-logger'
import { getSmsSettings } from '@/lib/sms-resolver'
import { resolveReminderTemplate } from '@/lib/sms-resolver'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'

export async function sendAppointmentReminderSMS(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is specialist
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, phone, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'specialist') {
    return { error: 'Only specialists can send appointment reminders' }
  }

  // Get demand details with dealer timezone info
  const { data: demand } = await supabase
    .from('demands')
    .select('appointment_date, customer_address, assigned_specialist_id, dealer_id, dealers(region_codes(timezone_id, timezones(name)))')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }
  
  if (demand.assigned_specialist_id !== user.id) {
    return { error: 'This demand is not assigned to you' }
  }

  const smsSettings = await getSmsSettings()
  const rh = smsSettings.four_hour_reminder
  if (!rh.enabled) return { error: 'SMS reminders are disabled in system settings' }

  const address = demand.customer_address || 'the specified location'
  const appointmentDate = new Date(demand.appointment_date)
  const now = new Date()
  const diffInHours = Math.floor((appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60))
  const hoursText = diffInHours === 1 ? '1 hour' : `${diffInHours} hours`

  const message = resolveReminderTemplate(rh.template, {
    hoursText,
    address,
    signature: smsSettings.signature,
  })

  // Send SMS to specialist
  if (profile.phone) {
    try {
      const result = await sendSMS(profile.phone, message)
      if (result.success) {
        logSmsSent({
          phoneNumber: profile.phone,
          recipientType: 'specialist',
          recipientName: profile.full_name ?? undefined,
          demandId,
          messageType: 'four_hour_reminder',
          triggeredBy: 'system',
        }).catch(() => {})
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

