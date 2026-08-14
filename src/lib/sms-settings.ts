/**
 * SMS Settings - stored in system_settings.sms_settings
 * Used by Aurora Manager to control when, to whom, and what SMS are sent.
 */

export type SMSTriggerType =
  | 'appointment_created'
  | 'cancellation_notice'
  | 'rescheduling_notice'
  | 'four_hour_reminder'
  | 'twenty_four_hour_reminder'

export type SMSLifecycleTriggerType =
  | 'post_completion_portal'
  | 'post_completion_custom'
  | 'sd_card_warranty_expired'
  | 'dashcam_warranty_expired'

export type AllSmsTriggerType = SMSTriggerType | SMSLifecycleTriggerType

export interface SMSTriggerSetting {
  enabled: boolean
  sendToCustomer: boolean
  sendToSpecialist?: boolean
  sendToAuroraManager?: boolean
  template: string
  /** Specialist-specific template (vehicle/VIN/stock/customer/dealer info) */
  specialistTemplate?: string
  description?: string
  hoursBefore?: number
}

export interface SMSLifecycleTriggerSetting {
  enabled: boolean
  sendToCustomer: boolean
  template: string
  description?: string
}

export interface SMSSettings {
  appointment_created: SMSTriggerSetting
  cancellation_notice: SMSTriggerSetting
  rescheduling_notice: SMSTriggerSetting
  four_hour_reminder: SMSTriggerSetting
  twenty_four_hour_reminder: SMSTriggerSetting
  post_completion_portal: SMSLifecycleTriggerSetting
  post_completion_custom: SMSLifecycleTriggerSetting
  sd_card_warranty_expired: SMSLifecycleTriggerSetting
  dashcam_warranty_expired: SMSLifecycleTriggerSetting
  contactPhone: string
  signature: string
}

export const DEFAULT_SPECIALIST_TEMPLATE =
  '{{vehicle_info}} - {{vin}} - {{stock}} {{customer_name}} {{customer_phone}} {{dealer_location}}'

export const DEFAULT_SMS_SETTINGS: SMSSettings = {
  appointment_created: {
    enabled: true,
    sendToCustomer: true,
    sendToSpecialist: true,
    sendToAuroraManager: true,
    template: `Appointment Created

A dashcam installation appointment has been scheduled for {{date}} at {{address}}.

{{signature}}`,
    specialistTemplate: DEFAULT_SPECIALIST_TEMPLATE,
    description: 'Sent when Finance approves a demand. Recipients: Customer, Assigned Specialist, Aurora Manager(s).',
  },
  cancellation_notice: {
    enabled: true,
    sendToCustomer: true,
    sendToSpecialist: true,
    template: `Cancellation / Rescheduling Notice

For cancellation or rescheduling requests within the last 24 hours prior to your appointment, please contact us at {{phone}}.

{{signature}}`,
    specialistTemplate: `${DEFAULT_SPECIALIST_TEMPLATE}

Cancellation notice. Contact {{phone}} for questions.`,
    description: 'Sent when a demand is cancelled. Recipients: Customer, Assigned Specialist.',
  },
  rescheduling_notice: {
    enabled: true,
    sendToCustomer: true,
    sendToSpecialist: true,
    template: `Rescheduling Notice

Your appointment has been rescheduled. For questions within 24 hours of your appointment, please contact us at {{phone}}.

{{signature}}`,
    specialistTemplate: `${DEFAULT_SPECIALIST_TEMPLATE}

Rescheduled to {{date}}. Contact {{phone}} for questions.`,
    description: 'Sent when a demand is rescheduled (appointment date changed). Recipients: Customer, Assigned Specialist.',
  },
  four_hour_reminder: {
    enabled: true,
    sendToCustomer: true,
    sendToSpecialist: true,
    hoursBefore: 4,
    template: `Appointment Reminder

This is a reminder that your dashcam installation appointment is scheduled to take place in {{hours}} at {{address}}.

{{signature}}`,
    specialistTemplate: `${DEFAULT_SPECIALIST_TEMPLATE}

Reminder: appointment in {{hours}} at {{address}}.`,
    description: 'Sent before appointment (automated cron). Configure hours (2, 4, or 6) and recipients below.',
  },
  twenty_four_hour_reminder: {
    enabled: true,
    sendToCustomer: true,
    sendToSpecialist: true,
    template: `24-Hour Appointment Reminder

This is a reminder that your dashcam installation appointment is scheduled to take place in {{hours}} at {{address}}.

{{signature}}`,
    specialistTemplate: `${DEFAULT_SPECIALIST_TEMPLATE}

24-hour reminder: appointment in {{hours}} at {{address}}.`,
    description: 'Sent 24 hours before appointment (automated cron). Recipients: Customer, Assigned Specialist.',
  },
  post_completion_portal: {
    enabled: true,
    sendToCustomer: true,
    template:
      'Thank you for choosing Aurora Dashcam: Please find your warranty, FAQ and dashcam details below: {{portal_link}}',
    description:
      'Sent automatically the day after installation completion. Includes a personalized customer portal link.',
  },
  post_completion_custom: {
    enabled: true,
    sendToCustomer: true,
    template: `Thank you for choosing Aurora Dashcam.

{{signature}}`,
    description:
      'Additional customizable message sent automatically the day after installation completion.',
  },
  sd_card_warranty_expired: {
    enabled: true,
    sendToCustomer: true,
    template:
      'SD Kartın Garanti süresi bitti, Kameranın garanti süresi devam etmektedir. Cihazınızı kontrol etmenizi tavsiye ederiz.',
    description: 'Sent 6 months after installation completion (SD card warranty expiry).',
  },
  dashcam_warranty_expired: {
    enabled: true,
    sendToCustomer: true,
    template:
      'GARANTINIZ BITMISTIR. DASHCAM DESTEGIMIZ DEVAM ETMEKTEDIR BIR SORUNUZ OLURSA SUPPORT@AURORAVEHICLES.COM UZERINDEN UALASABILIRSINIZ YADA 604 833 5801.',
    description: 'Sent on dashcam installation warranty end date.',
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
  '{{vehicle_info}}': 'Vehicle year, make, model',
  '{{vin}}': 'VIN (last 6 digits)',
  '{{stock}}': 'Stock number',
  '{{customer_name}}': 'Customer full name',
  '{{customer_phone}}': 'Customer phone number',
  '{{dealer_location}}': 'Dealer address or name',
  '{{portal_link}}': 'Personalized customer portal URL',
}

export const SMS_LIFECYCLE_TRIGGER_LABELS: Record<SMSLifecycleTriggerType, string> = {
  post_completion_portal: 'Post-Completion Portal Link',
  post_completion_custom: 'Post-Completion Custom Message',
  sd_card_warranty_expired: 'SD Card Warranty Expired',
  dashcam_warranty_expired: 'Dashcam Warranty Expired',
}
