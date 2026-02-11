import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone } from './timezone-defaults'

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
  const tz = getEffectiveTimezone(timezoneName ?? null)
  const formattedDate = formatInTimeZone(appointmentDate, tz, 'MMMM dd, yyyy \'at\' HH:mm')
  
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
 * Sent before the appointment. When sent in the "4h before" window, message says "in 4 hours".
 * @param appointmentDate - The appointment date (ISO/UTC moment)
 * @param address - The appointment address
 * @param timezoneName - Optional dealer timezone. If not provided, uses PST (system default)
 * @param forceFourHours - If true, message always says "in 4 hours" (used when sending exactly 4h before)
 */
export function getFourHourReminderMessage(
  appointmentDate: Date,
  address: string,
  timezoneName?: string,
  forceFourHours?: boolean
): string {
  const now = new Date()
  const appointment = new Date(appointmentDate)
  const diffInMs = appointment.getTime() - now.getTime()
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const hoursToShow = forceFourHours ? 4 : diffInHours
  const hoursText = hoursToShow === 1 ? '1 hour' : `${hoursToShow} hours`
  
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

/**
 * Check if appointment is in the "4 hours before" reminder window.
 * Used by cron to send reminder exactly ~4 hours before (e.g. 11:00 appointment → 07:00 in dealer time).
 * Window: 3.5h to 4.5h from now so hourly cron catches the right appointments.
 * Time is evaluated in dealer timezone: we use the same real-time difference (4h is 4h everywhere),
 * but timezoneName is required so the system is consistent with dealer-local scheduling.
 */
export function isWithin4HoursBeforeWindow(appointmentDate: Date, _timezoneName?: string | null): boolean {
  const now = new Date()
  const appointment = new Date(appointmentDate)
  const diffInMs = appointment.getTime() - now.getTime()
  const diffInHours = diffInMs / (1000 * 60 * 60)
  return diffInHours > 3.5 && diffInHours <= 4.5
}

