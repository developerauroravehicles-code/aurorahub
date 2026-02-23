/**
 * SMS Settings - stored in system_settings.sms_settings
 * Used by Aurora Manager to control when, to whom, and what SMS are sent.
 */

export type SMSTriggerType = 'appointment_created' | 'cancellation_notice' | 'rescheduling_notice' | 'four_hour_reminder'

export interface SMSTriggerSetting {
  enabled: boolean
  sendToCustomer: boolean
  sendToSpecialist?: boolean // for appointment_created, four_hour_reminder, cancellation_notice, rescheduling_notice
  template: string
  /** Display description */
  description?: string
}

export interface SMSSettings {
  appointment_created: SMSTriggerSetting
  cancellation_notice: SMSTriggerSetting
  rescheduling_notice: SMSTriggerSetting
  four_hour_reminder: SMSTriggerSetting
  /** Contact phone shown in cancellation/rescheduling notice */
  contactPhone: string
  /** Signature/branding at end of messages */
  signature: string
}

export const DEFAULT_SMS_SETTINGS: SMSSettings = {
  appointment_created: {
    enabled: true,
    sendToCustomer: true,
    sendToSpecialist: true,
    template: `Appointment Created

A dashcam installation appointment has been scheduled for {{date}} at {{address}}.

{{signature}}`,
    description: 'Sent when Finance approves a demand. Recipients: Customer, Assigned Specialist.',
  },
  cancellation_notice: {
    enabled: true,
    sendToCustomer: true,
    sendToSpecialist: true,
    template: `Cancellation / Rescheduling Notice

For cancellation or rescheduling requests within the last 24 hours prior to your appointment, please contact us at {{phone}}.

{{signature}}`,
    description: 'Sent when a demand is cancelled. Recipients: Customer, Assigned Specialist.',
  },
  rescheduling_notice: {
    enabled: true,
    sendToCustomer: true,
    sendToSpecialist: true,
    template: `Rescheduling Notice

Your appointment has been rescheduled. For questions within 24 hours of your appointment, please contact us at {{phone}}.

{{signature}}`,
    description: 'Sent when a demand is rescheduled (appointment date changed). Recipients: Customer, Assigned Specialist.',
  },
  four_hour_reminder: {
    enabled: true,
    sendToCustomer: true,
    sendToSpecialist: true,
    template: `Appointment Reminder

This is a reminder that your dashcam installation appointment is scheduled to take place in {{hours}} at {{address}}.

{{signature}}`,
    description: 'Sent ~4 hours before appointment (automated cron). Recipients: Customer and Assigned Specialist (same message, same time).',
  },
  contactPhone: '(604) 833-5801',
  signature: 'Aurora Vehicles.',
}

/** Placeholders and their descriptions for the UI */
export const SMS_PLACEHOLDERS: Record<string, string> = {
  '{{date}}': 'Appointment date (e.g. February 9, 2026 at 2:30 PM)',
  '{{address}}': 'Appointment address',
  '{{hours}}': 'Hours until appointment (e.g. 4 hours)',
  '{{phone}}': 'Contact phone number',
  '{{signature}}': 'Brand/signature (e.g. Aurora Vehicles.)',
}
