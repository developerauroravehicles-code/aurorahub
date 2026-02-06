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
 * 4-Hour Reminder Message
 * Sent 4 hours before the appointment
 * @param address - The appointment address
 * @param timezoneName - Optional timezone name (e.g., 'America/Vancouver'). If not provided, uses local timezone
 */
export function getFourHourReminderMessage(address: string, timezoneName?: string): string {
  // Note: This message doesn't include a date, but if we add one in the future, use timezoneName
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

