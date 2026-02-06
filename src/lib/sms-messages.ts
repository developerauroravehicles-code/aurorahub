import { format, formatInTimeZone } from 'date-fns-tz'

/**
 * SMS Message Templates
 * All SMS messages follow the new format structure
 */

export type SMSMessageType = 'appointment_created' | 'cancellation_notice' | 'four_hour_reminder'

/**
 * Appointment Created Message
 * Sent when a demand is approved by finance
 * @param appointmentDate - The appointment date (UTC)
 * @param address - The appointment address
 * @param timezoneName - Optional timezone name (e.g., 'America/Vancouver'). If not provided, uses local timezone
 */
export function getAppointmentCreatedMessage(
  appointmentDate: Date,
  address: string,
  timezoneName?: string
): string {
  let formattedDate: string
  if (timezoneName) {
    formattedDate = formatInTimeZone(appointmentDate, timezoneName, 'MMMM dd, yyyy \'at\' HH:mm')
  } else {
    formattedDate = format(appointmentDate, 'MMMM dd, yyyy \'at\' HH:mm')
  }
  
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
 * Reminder Message
 * Sent before the appointment (dynamically calculates hours remaining)
 * @param appointmentDate - The appointment date (UTC)
 * @param address - The appointment address
 * @param timezoneName - Optional timezone name (e.g., 'America/Vancouver'). If not provided, uses local timezone
 */
export function getFourHourReminderMessage(
  appointmentDate: Date,
  address: string,
  timezoneName?: string
): string {
  // Calculate hours remaining until appointment
  const now = new Date()
  const appointment = new Date(appointmentDate)
  const diffInMs = appointment.getTime() - now.getTime()
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  
  // Format hours text (singular vs plural)
  const hoursText = diffInHours === 1 ? '1 hour' : `${diffInHours} hours`
  
  return `Appointment Reminder

This is a reminder that your dashcam installation appointment is scheduled to take place in ${hoursText} at ${address}.

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

