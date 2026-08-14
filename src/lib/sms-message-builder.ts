import type { SMSTriggerSetting, SMSTriggerType } from './sms-settings'
import {
  resolveAppointmentCreatedTemplate,
  resolveCancellationTemplate,
  resolveReminderTemplate,
} from './sms-resolver'
import { getSpecialistTemplateText, resolveSpecialistTemplate, type SpecialistDemandFields } from './sms-specialist-template'

export interface SmsDealerContext {
  name?: string | null
  address?: string | null
  timezoneName?: string
}

export type SmsDemandContext = SpecialistDemandFields & {
  customer_address?: string | null
  appointment_date?: string | null
}

export function buildCustomerSmsMessage(
  triggerType: SMSTriggerType,
  trigger: SMSTriggerSetting,
  demand: SmsDemandContext,
  dealer: SmsDealerContext | null,
  opts: { contactPhone: string; signature: string; hoursText?: string }
): string {
  const address = demand.customer_address || dealer?.address || dealer?.name || 'Authorized Dealer'
  const appointmentDate = demand.appointment_date ? new Date(demand.appointment_date) : new Date()

  switch (triggerType) {
    case 'appointment_created':
      return resolveAppointmentCreatedTemplate(trigger.template, {
        appointmentDate,
        address,
        timezoneName: dealer?.timezoneName,
        signature: opts.signature,
      })
    case 'cancellation_notice':
    case 'rescheduling_notice':
      return resolveCancellationTemplate(trigger.template, {
        phone: opts.contactPhone,
        signature: opts.signature,
        appointmentDate: triggerType === 'rescheduling_notice' ? appointmentDate : undefined,
        timezoneName: dealer?.timezoneName,
      })
    case 'four_hour_reminder':
    case 'twenty_four_hour_reminder':
      return resolveReminderTemplate(trigger.template, {
        hoursText: opts.hoursText ?? '4 hours',
        address,
        signature: opts.signature,
      })
    default:
      return trigger.template
  }
}

export function buildSpecialistSmsMessage(
  triggerType: SMSTriggerType,
  trigger: SMSTriggerSetting,
  demand: SmsDemandContext,
  dealer: SmsDealerContext | null,
  opts: { contactPhone: string; signature: string; hoursText?: string }
): string {
  const address = demand.customer_address || dealer?.address || dealer?.name || 'Authorized Dealer'
  const appointmentDate = demand.appointment_date ? new Date(demand.appointment_date) : undefined
  const template = getSpecialistTemplateText(trigger)

  return resolveSpecialistTemplate(template, {
    demand,
    dealer,
    signature: opts.signature,
    phone: opts.contactPhone,
    hoursText: opts.hoursText,
    appointmentDate,
    timezoneName: dealer?.timezoneName,
    address,
  })
}
