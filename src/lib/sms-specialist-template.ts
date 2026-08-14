import { formatInTimeZone } from 'date-fns-tz'
import type { SMSTriggerSetting } from './sms-settings'
import { DEFAULT_SPECIALIST_TEMPLATE } from './sms-settings'
import { getEffectiveTimezone } from './timezone-defaults'

export interface SpecialistDemandFields {
  vehicle_year?: number | null
  vehicle_make?: string | null
  vehicle_model?: string | null
  vin_last6?: string | null
  stock_number?: string | null
  customer_firstname?: string | null
  customer_lastname?: string | null
  customer_phone?: string | null
  customer_address?: string | null
  appointment_date?: string | null
}

export interface SpecialistDealerFields {
  name?: string | null
  address?: string | null
}

export interface SpecialistTemplateContext {
  demand: SpecialistDemandFields
  dealer?: SpecialistDealerFields | null
  signature?: string
  phone?: string
  hoursText?: string
  appointmentDate?: Date
  timezoneName?: string
  address?: string
}

function vehicleInfo(demand: SpecialistDemandFields): string {
  const parts = [demand.vehicle_year, demand.vehicle_make, demand.vehicle_model]
    .filter((p) => p != null && String(p).trim() !== '')
    .map(String)
  return parts.join(' ').trim() || '—'
}

function customerName(demand: SpecialistDemandFields): string {
  return `${demand.customer_firstname ?? ''} ${demand.customer_lastname ?? ''}`.trim() || '—'
}

function dealerLocation(dealer: SpecialistDealerFields | null | undefined, demand: SpecialistDemandFields): string {
  return (dealer?.address ?? demand.customer_address ?? dealer?.name ?? 'Authorized Dealer').trim()
}

/** Resolve specialist template placeholders for job info block + trigger-specific vars. */
export function resolveSpecialistTemplate(template: string, ctx: SpecialistTemplateContext): string {
  const { demand, dealer } = ctx
  let result = template
    .replace(/\{\{vehicle_info\}\}/g, vehicleInfo(demand))
    .replace(/\{\{vin\}\}/g, (demand.vin_last6 ?? '—').trim() || '—')
    .replace(/\{\{stock\}\}/g, (demand.stock_number ?? '—').trim() || '—')
    .replace(/\{\{customer_name\}\}/g, customerName(demand))
    .replace(/\{\{customer_phone\}\}/g, (demand.customer_phone ?? '—').trim() || '—')
    .replace(/\{\{dealer_location\}\}/g, dealerLocation(dealer, demand))

  if (ctx.phone) result = result.replace(/\{\{phone\}\}/g, ctx.phone)
  if (ctx.hoursText) result = result.replace(/\{\{hours\}\}/g, ctx.hoursText)
  if (ctx.address) result = result.replace(/\{\{address\}\}/g, ctx.address)
  if (ctx.signature) result = result.replace(/\{\{signature\}\}/g, ctx.signature)

  if (ctx.appointmentDate) {
    const tz = getEffectiveTimezone(ctx.timezoneName ?? null)
    const dateStr = formatInTimeZone(ctx.appointmentDate, tz, "MMMM dd, yyyy 'at' h:mm a")
    result = result.replace(/\{\{date\}\}/g, dateStr)
  }

  return result
}

export function getSpecialistTemplateText(trigger: SMSTriggerSetting): string {
  const t = trigger.specialistTemplate?.trim()
  return t && t.length > 0 ? t : DEFAULT_SPECIALIST_TEMPLATE
}
