import { format } from 'date-fns'

/**
 * SMS Message Templates
 * All SMS messages follow the new format structure
 */

export type SMSMessageType = 'appointment_created' | 'cancellation_notice' | 'four_hour_reminder'

/**
 * Appointment Created Message
 * Sent when a demand is approved by finance
 */
export function getAppointmentCreatedMessage(
  appointmentDate: Date,
  address: string
): string {
  const formattedDate = format(appointmentDate, 'MMMM dd, yyyy \'at\' HH:mm')
  
  return `Appointment Created

A dashcam installation appointment has been scheduled for ${formattedDate} at ${address}.

Aurora Vehicles.`
}

/**
 * Cancellation / Rescheduling Notice
 * Sent when a demand is cancelled or rescheduled within 24 hours of appointment
 */
export function getCancellationNoticeMessage(): string {
  return `Cancellation / Rescheduling Notice

For cancellation or rescheduling requests within the last 24 hours prior to your appointment, please contact us at (604) 833-5801.`
}

/**
 * 4-Hour Reminder Message
 * Sent 4 hours before the appointment
 */
export function getFourHourReminderMessage(address: string): string {
  return `4-Hour Reminder

This is a reminder that your dashcam installation appointment is scheduled to take place in 4 hours at ${address}.

Aurora Vehicles.`
}

/**
 * Check if appointment is within 24 hours
 */
export function isWithin24Hours(appointmentDate: Date): boolean {
  const now = new Date()
  const appointment = new Date(appointmentDate)
  const diffInMs = appointment.getTime() - now.getTime()
  const diffInHours = diffInMs / (1000 * 60 * 60)
  return diffInHours > 0 && diffInHours <= 24
}

/**
 * Check if appointment is within 4 hours
 */
export function isWithin4Hours(appointmentDate: Date): boolean {
  const now = new Date()
  const appointment = new Date(appointmentDate)
  const diffInMs = appointment.getTime() - now.getTime()
  const diffInHours = diffInMs / (1000 * 60 * 60)
  return diffInHours > 0 && diffInHours <= 4
}

