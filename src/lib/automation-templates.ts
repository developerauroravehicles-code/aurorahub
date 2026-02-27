/**
 * Automation template registry.
 * Defines available automation types for the Automation tab.
 * Templates are organized by category: SMS, Reporting, Calendar, Camera & Dealer.
 */

export type AutomationType = 'scheduled' | 'event'

export type AutomationCategory = 'reporting' | 'sms' | 'calendar' | 'camera_dealer'

export type TemplateId =
  | 'sms_reminder_4h'
  | 'sms_reminder_24h'
  | 'sms_appointment_created'
  | 'sms_cancellation'
  | 'sms_rescheduling'
  | 'daily_report_email'
  | 'weekly_summary'
  | 'daily_report_sales'
  | 'daily_report_finance'
  | 'daily_report_admin'
  | 'daily_report_specialist'
  | 'weekly_report_sales'
  | 'weekly_report_finance'
  | 'weekly_report_admin'
  | 'weekly_report_specialist'
  | 'monthly_report_admin'
  | 'calendar_slot_sync'
  | 'calendar_past_slots_lock'
  | 'camera_low_stock_alert'
  | 'camera_dealer_assignment_notify'

export interface AutomationParamDef {
  key: string
  label: string
  type: 'boolean' | 'number' | 'select' | 'string'
  options?: { value: number | string; label: string }[]
  default: unknown
}

export interface AutomationTemplate {
  id: TemplateId
  category: AutomationCategory
  name: string
  description: string
  type: AutomationType
  params: AutomationParamDef[]
  /** For event types: maps to sms_settings key */
  smsSettingKey?: string
  /** For scheduled SMS: API path or identifier */
  apiIdentifier?: string
}

export const AUTOMATION_CATEGORIES: Record<
  AutomationCategory,
  { name: string; description: string }
> = {
  reporting: {
    name: 'Reporting',
    description: 'Email reports, daily/weekly summaries',
  },
  sms: {
    name: 'SMS',
    description: 'Reminder, approval, cancellation, rescheduling SMS',
  },
  calendar: {
    name: 'Calendar',
    description: 'Calendar blocks, slot synchronization',
  },
  camera_dealer: {
    name: 'Camera & Dealer',
    description: 'Camera model-dealer assignment, stock alerts',
  },
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  // SMS category
  {
    id: 'sms_reminder_4h',
    category: 'sms',
    name: '4 Hour SMS Reminder',
    description: 'Sends reminder SMS to customer and specialist 2, 4, or 6 hours before appointment.',
    type: 'scheduled',
    apiIdentifier: 'send-reminders',
    params: [
      {
        key: 'hoursBefore',
        label: 'Hours before to send',
        type: 'select',
        options: [
          { value: 2, label: '2 hours before' },
          { value: 4, label: '4 hours before' },
          { value: 6, label: '6 hours before' },
        ],
        default: 4,
      },
      { key: 'sendToCustomer', label: 'Send to customer', type: 'boolean', default: true },
      { key: 'sendToSpecialist', label: "Send to specialist", type: 'boolean', default: true },
    ],
  },
  {
    id: 'sms_reminder_24h',
    category: 'sms',
    name: '24 Hour SMS Reminder',
    description: 'Sends reminder SMS to customer and specialist 24 hours before appointment.',
    type: 'scheduled',
    apiIdentifier: 'send-reminders-24h',
    params: [
      {
        key: 'hoursBefore',
        label: 'Hours before to send',
        type: 'select',
        options: [{ value: 24, label: '24 hours before' }],
        default: 24,
      },
      { key: 'sendToCustomer', label: 'Send to customer', type: 'boolean', default: true },
      { key: 'sendToSpecialist', label: "Send to specialist", type: 'boolean', default: true },
    ],
  },
  {
    id: 'sms_appointment_created',
    category: 'sms',
    name: 'Appointment Approval SMS',
    description: 'Sends SMS to customer, specialist and Aurora Manager when Finance approves the demand.',
    type: 'event',
    smsSettingKey: 'appointment_created',
    params: [],
  },
  {
    id: 'sms_cancellation',
    category: 'sms',
    name: 'Cancellation Notification SMS',
    description: 'Sends notification SMS to customer and specialist when demand is cancelled.',
    type: 'event',
    smsSettingKey: 'cancellation_notice',
    params: [],
  },
  {
    id: 'sms_rescheduling',
    category: 'sms',
    name: 'Appointment Rescheduling SMS',
    description: 'Sends notification SMS to customer and specialist when appointment date is changed.',
    type: 'event',
    smsSettingKey: 'rescheduling_notice',
    params: [],
  },
  // Reporting category - full template set per plan
  {
    id: 'daily_report_email',
    category: 'reporting',
    name: 'Daily Report Email',
    description: 'Sends report email at a scheduled time each day.',
    type: 'scheduled',
    params: [
      { key: 'scheduleTime', label: 'Send time', type: 'string', default: '09:00' },
      { key: 'recipientType', label: 'Recipient type', type: 'select', options: [{ value: 'aurora_manager', label: 'Aurora Manager' }, { value: 'role_based', label: 'Role based' }, { value: 'custom', label: 'Custom email list' }], default: 'aurora_manager' },
      { key: 'customEmails', label: 'Custom email addresses (comma-separated)', type: 'string', default: '' },
      { key: 'includePdfAttachment', label: 'Send with PDF attachment', type: 'boolean', default: true },
    ],
  },
  {
    id: 'weekly_summary',
    category: 'reporting',
    name: 'Weekly Summary',
    description: 'Sends weekly statistics email.',
    type: 'scheduled',
    params: [
      { key: 'scheduleTime', label: 'Send time', type: 'string', default: '09:00' },
      { key: 'recipientType', label: 'Recipient type', type: 'select', options: [{ value: 'aurora_manager', label: 'Aurora Manager' }, { value: 'role_based', label: 'Role based' }, { value: 'custom', label: 'Custom email list' }], default: 'aurora_manager' },
      { key: 'customEmails', label: 'Custom email addresses (comma-separated)', type: 'string', default: '' },
      { key: 'includePdfAttachment', label: 'Send with PDF attachment', type: 'boolean', default: true },
    ],
  },
  {
    id: 'daily_report_sales',
    category: 'reporting',
    name: 'Daily Sales Report',
    description: 'Sales-created demands, daily.',
    type: 'scheduled',
    params: [
      { key: 'scheduleTime', label: 'Send time', type: 'string', default: '09:00' },
      { key: 'recipientType', label: 'Recipient type', type: 'select', options: [{ value: 'aurora_manager', label: 'Aurora Manager' }, { value: 'role_based', label: 'Role based' }, { value: 'custom', label: 'Custom email list' }], default: 'aurora_manager' },
      { key: 'customEmails', label: 'Custom email addresses (comma-separated)', type: 'string', default: '' },
      { key: 'includePdfAttachment', label: 'Send with PDF attachment', type: 'boolean', default: true },
    ],
  },
  {
    id: 'daily_report_finance',
    category: 'reporting',
    name: 'Daily Finance Report',
    description: "Finance's assigned demands.",
    type: 'scheduled',
    params: [
      { key: 'scheduleTime', label: 'Send time', type: 'string', default: '09:00' },
      { key: 'recipientType', label: 'Recipient type', type: 'select', options: [{ value: 'aurora_manager', label: 'Aurora Manager' }, { value: 'role_based', label: 'Role based' }, { value: 'custom', label: 'Custom email list' }], default: 'aurora_manager' },
      { key: 'customEmails', label: 'Custom email addresses (comma-separated)', type: 'string', default: '' },
      { key: 'includePdfAttachment', label: 'Send with PDF attachment', type: 'boolean', default: true },
    ],
  },
  {
    id: 'daily_report_admin',
    category: 'reporting',
    name: 'Daily Admin Report',
    description: 'All demands (optional dealer filter).',
    type: 'scheduled',
    params: [
      { key: 'scheduleTime', label: 'Send time', type: 'string', default: '09:00' },
      { key: 'recipientType', label: 'Recipient type', type: 'select', options: [{ value: 'aurora_manager', label: 'Aurora Manager' }, { value: 'role_based', label: 'Role based' }, { value: 'custom', label: 'Custom email list' }], default: 'aurora_manager' },
      { key: 'customEmails', label: 'Custom email addresses (comma-separated)', type: 'string', default: '' },
      { key: 'includePdfAttachment', label: 'Send with PDF attachment', type: 'boolean', default: true },
      { key: 'dealerId', label: 'Dealer (all if empty)', type: 'string', default: '' },
    ],
  },
  {
    id: 'daily_report_specialist',
    category: 'reporting',
    name: 'Daily Specialist Appointments',
    description: "Specialist's appointments.",
    type: 'scheduled',
    params: [
      { key: 'scheduleTime', label: 'Send time', type: 'string', default: '09:00' },
      { key: 'recipientType', label: 'Recipient type', type: 'select', options: [{ value: 'aurora_manager', label: 'Aurora Manager' }, { value: 'role_based', label: 'Role based' }, { value: 'custom', label: 'Custom email list' }], default: 'aurora_manager' },
      { key: 'customEmails', label: 'Custom email addresses (comma-separated)', type: 'string', default: '' },
      { key: 'includePdfAttachment', label: 'Send with PDF attachment', type: 'boolean', default: true },
    ],
  },
  {
    id: 'weekly_report_sales',
    category: 'reporting',
    name: 'Weekly Sales Report',
    description: 'Sales summary, weekly.',
    type: 'scheduled',
    params: [
      { key: 'scheduleTime', label: 'Send time', type: 'string', default: '09:00' },
      { key: 'recipientType', label: 'Recipient type', type: 'select', options: [{ value: 'aurora_manager', label: 'Aurora Manager' }, { value: 'role_based', label: 'Role based' }, { value: 'custom', label: 'Custom email list' }], default: 'aurora_manager' },
      { key: 'customEmails', label: 'Custom email addresses (comma-separated)', type: 'string', default: '' },
      { key: 'includePdfAttachment', label: 'Send with PDF attachment', type: 'boolean', default: true },
    ],
  },
  {
    id: 'weekly_report_finance',
    category: 'reporting',
    name: 'Weekly Finance Report',
    description: 'Finance summary.',
    type: 'scheduled',
    params: [
      { key: 'scheduleTime', label: 'Send time', type: 'string', default: '09:00' },
      { key: 'recipientType', label: 'Recipient type', type: 'select', options: [{ value: 'aurora_manager', label: 'Aurora Manager' }, { value: 'role_based', label: 'Role based' }, { value: 'custom', label: 'Custom email list' }], default: 'aurora_manager' },
      { key: 'customEmails', label: 'Custom email addresses (comma-separated)', type: 'string', default: '' },
      { key: 'includePdfAttachment', label: 'Send with PDF attachment', type: 'boolean', default: true },
    ],
  },
  {
    id: 'weekly_report_admin',
    category: 'reporting',
    name: 'Weekly Admin Report',
    description: 'Admin summary.',
    type: 'scheduled',
    params: [
      { key: 'scheduleTime', label: 'Send time', type: 'string', default: '09:00' },
      { key: 'recipientType', label: 'Recipient type', type: 'select', options: [{ value: 'aurora_manager', label: 'Aurora Manager' }, { value: 'role_based', label: 'Role based' }, { value: 'custom', label: 'Custom email list' }], default: 'aurora_manager' },
      { key: 'customEmails', label: 'Custom email addresses (comma-separated)', type: 'string', default: '' },
      { key: 'includePdfAttachment', label: 'Send with PDF attachment', type: 'boolean', default: true },
      { key: 'dealerId', label: 'Dealer (all if empty)', type: 'string', default: '' },
    ],
  },
  {
    id: 'weekly_report_specialist',
    category: 'reporting',
    name: 'Weekly Specialist Summary',
    description: 'Completed jobs.',
    type: 'scheduled',
    params: [
      { key: 'scheduleTime', label: 'Send time', type: 'string', default: '09:00' },
      { key: 'recipientType', label: 'Recipient type', type: 'select', options: [{ value: 'aurora_manager', label: 'Aurora Manager' }, { value: 'role_based', label: 'Role based' }, { value: 'custom', label: 'Custom email list' }], default: 'aurora_manager' },
      { key: 'customEmails', label: 'Custom email addresses (comma-separated)', type: 'string', default: '' },
      { key: 'includePdfAttachment', label: 'Send with PDF attachment', type: 'boolean', default: true },
    ],
  },
  {
    id: 'monthly_report_admin',
    category: 'reporting',
    name: 'Monthly Admin Summary',
    description: 'Includes camera/status distribution.',
    type: 'scheduled',
    params: [
      { key: 'scheduleTime', label: 'Send time', type: 'string', default: '09:00' },
      { key: 'recipientType', label: 'Recipient type', type: 'select', options: [{ value: 'aurora_manager', label: 'Aurora Manager' }, { value: 'role_based', label: 'Role based' }, { value: 'custom', label: 'Custom email list' }], default: 'aurora_manager' },
      { key: 'customEmails', label: 'Custom email addresses (comma-separated)', type: 'string', default: '' },
      { key: 'includePdfAttachment', label: 'Send with PDF attachment', type: 'boolean', default: true },
      { key: 'dealerId', label: 'Dealer (all if empty)', type: 'string', default: '' },
    ],
  },
  // Calendar category
  {
    id: 'calendar_slot_sync',
    category: 'calendar',
    name: 'Closed Slot Synchronization',
    description: 'Slots closed in System Management are hidden on the demand form. System behavior.',
    type: 'scheduled',
    params: [],
  },
  {
    id: 'calendar_past_slots_lock',
    category: 'calendar',
    name: 'Past Slot Locking',
    description: 'Locks past days and slots based on dealer timezone. (Future feature)',
    type: 'scheduled',
    params: [],
  },
  // Camera & Dealer category
  {
    id: 'camera_low_stock_alert',
    category: 'camera_dealer',
    name: 'Low Stock Alert',
    description: 'Email notification when camera model stock falls below threshold.',
    type: 'scheduled',
    params: [
      { key: 'dealerId', label: 'Dealer', type: 'string', default: '' },
      { key: 'cameraModelId', label: 'Camera model', type: 'string', default: '' },
      { key: 'threshold', label: 'Threshold (stock count)', type: 'number', default: 5 },
    ],
  },
  {
    id: 'camera_dealer_assignment_notify',
    category: 'camera_dealer',
    name: 'Dealer–Camera Assignment Notification',
    description: 'Notification when camera model is assigned to or removed from dealer. (Future feature)',
    type: 'event',
    params: [],
  },
]

export function getTemplateById(id: TemplateId): AutomationTemplate | undefined {
  return AUTOMATION_TEMPLATES.find((t) => t.id === id)
}

export function getTemplatesByCategory(category: AutomationCategory): AutomationTemplate[] {
  return AUTOMATION_TEMPLATES.filter((t) => t.category === category)
}

/** Maps automation templateId to SMS trigger key for fetching/editing message content */
export const TEMPLATE_TO_SMS_TRIGGER: Partial<Record<TemplateId, 'appointment_created' | 'cancellation_notice' | 'rescheduling_notice' | 'four_hour_reminder'>> = {
  sms_reminder_4h: 'four_hour_reminder',
  sms_reminder_24h: 'four_hour_reminder',
  sms_appointment_created: 'appointment_created',
  sms_cancellation: 'cancellation_notice',
  sms_rescheduling: 'rescheduling_notice',
}

export function getSmsTriggerForTemplate(templateId: TemplateId): 'appointment_created' | 'cancellation_notice' | 'rescheduling_notice' | 'four_hour_reminder' | null {
  return TEMPLATE_TO_SMS_TRIGGER[templateId] ?? null
}

export function getDefaultParams(templateId: TemplateId): Record<string, unknown> {
  const template = getTemplateById(templateId)
  if (!template) return {}
  const params: Record<string, unknown> = {}
  for (const p of template.params) {
    params[p.key] = p.default
  }
  return params
}
