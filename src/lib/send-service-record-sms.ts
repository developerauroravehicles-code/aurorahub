import { formatInTimeZone } from 'date-fns-tz'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSmsSent } from '@/lib/sms-logger'
import { getSmsSettings } from '@/lib/sms-resolver'
import { sendSMS } from '@/lib/twilio'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import type { CustomerServiceRecord } from '@/types/customer-service-record'

export type SendServiceRecordSmsResult =
  | { ok: true }
  | { ok: false; error: string }

export function buildServiceRecordSmsBody(
  appointmentAt: Date,
  location: string,
  signature: string
): string {
  const dateStr = formatInTimeZone(
    appointmentAt,
    SYSTEM_DEFAULT_TIMEZONE,
    "EEEE, MMMM d, yyyy 'at' h:mm a zzz"
  )
  const loc = location.trim() || '18439 68 Ave, Surrey V3S 9H8'
  const sig = signature.trim() || 'Aurora Vehicles Incorporation'

  return `Service Appointment Scheduled

Your dashcam service appointment is scheduled for ${dateStr} at ${loc}.

${sig}`
}

export async function sendServiceRecordAppointmentSms(
  record: Pick<
    CustomerServiceRecord,
    'id' | 'demand_id' | 'customer_phone' | 'customer_firstname' | 'service_appointment_at' | 'service_location'
  >
): Promise<SendServiceRecordSmsResult> {
  if (!record.service_appointment_at) {
    return { ok: false, error: 'Appointment date is missing.' }
  }

  const phone = record.customer_phone?.trim()
  if (!phone) {
    return { ok: false, error: 'Customer phone number is missing.' }
  }

  const settings = await getSmsSettings(createAdminClient())
  const body = buildServiceRecordSmsBody(
    new Date(record.service_appointment_at),
    record.service_location,
    settings.signature
  )

  const sent = await sendSMS(phone, body)
  if (!sent.success) {
    return { ok: false, error: 'SMS could not be sent. Please verify the phone number and Twilio settings.' }
  }

  await logSmsSent({
    phoneNumber: phone,
    recipientType: 'customer',
    recipientName: record.customer_firstname || undefined,
    demandId: record.demand_id,
    messageType: 'service_appointment_scheduled',
    triggeredBy: 'system',
    messageContent: body,
  })

  return { ok: true }
}
