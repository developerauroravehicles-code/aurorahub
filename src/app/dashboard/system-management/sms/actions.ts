'use server'

import { createClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio'
import { logSmsSent } from '@/lib/sms-logger'
import { getSmsSettings } from '@/lib/sms-resolver'
import {
  resolveAppointmentCreatedTemplate,
  resolveCancellationTemplate,
  resolveReminderTemplate,
} from '@/lib/sms-resolver'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import type { SMSTriggerType } from '@/lib/sms-settings'

export interface DemandOption {
  id: string
  label: string
  customer_phone: string | null
  customer_address: string | null
  appointment_date: string
  dealer_id: string
  assigned_specialist_id: string | null
  dealers: { region_codes?: { timezones?: { name: string } } } | null
}

export interface SmsLogEntry {
  id: string
  sent_at: string
  phone_number: string
  recipient_type: string
  recipient_name: string | null
  demand_id: string | null
  message_type: string
  triggered_by: string
}

export async function getSmsLogs(filters?: {
  dateFrom?: string
  dateTo?: string
  customerName?: string
}): Promise<{ error?: string; logs?: SmsLogEntry[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') return { error: 'Only Aurora Managers can view SMS logs' }

  let query = supabase
    .from('sms_logs')
    .select('id, sent_at, phone_number, recipient_type, recipient_name, demand_id, message_type, triggered_by')
    .order('sent_at', { ascending: false })
    .limit(200)

  if (filters?.dateFrom) {
    query = query.gte('sent_at', `${filters.dateFrom}T00:00:00.000Z`)
  }
  if (filters?.dateTo) {
    query = query.lte('sent_at', `${filters.dateTo}T23:59:59.999Z`)
  }
  if (filters?.customerName?.trim()) {
    const term = filters.customerName.trim().toLowerCase()
    query = query.ilike('recipient_name', `%${term}%`)
  }

  const { data, error } = await query
  if (error) return { error: error.message }
  return { logs: (data ?? []) as SmsLogEntry[] }
}

export async function getDemandsForManualSms(): Promise<{ error?: string; demands?: DemandOption[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') return { error: 'Only Aurora Managers can send manual SMS' }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90)

  const { data: demands, error } = await supabase
    .from('demands')
    .select('id, customer_firstname, customer_lastname, customer_phone, customer_address, appointment_date, dealer_id, assigned_specialist_id, dealers(region_codes(timezone_id, timezones(name)))')
    .in('status', ['approved', 'pending_finance', 'completed'])
    .gte('appointment_date', thirtyDaysAgo.toISOString())
    .not('customer_phone', 'is', null)
    .order('appointment_date', { ascending: false })
    .limit(100)

  if (error) return { error: error.message }
  if (!demands?.length) return { demands: [] }

  const options: DemandOption[] = demands.map((d: Record<string, unknown>) => {
    const appointmentDate = new Date((d.appointment_date as string)).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const name = `${d.customer_firstname} ${d.customer_lastname}`.trim() || 'Unknown'
    return {
      id: d.id as string,
      label: `${name} - ${appointmentDate}`,
      customer_phone: d.customer_phone as string | null,
      customer_address: d.customer_address as string | null,
      appointment_date: d.appointment_date as string,
      dealer_id: d.dealer_id as string,
      assigned_specialist_id: d.assigned_specialist_id as string | null,
      dealers: d.dealers as DemandOption['dealers'],
    }
  })
  return { demands: options }
}

export async function sendManualSms(
  demandId: string,
  messageType: SMSTriggerType,
  recipient: 'customer' | 'specialist'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') return { success: false, error: 'Only Aurora Managers can send manual SMS' }

  const { data: demand, error: demandError } = await supabase
    .from('demands')
    .select('customer_phone, customer_firstname, customer_lastname, customer_address, appointment_date, dealer_id, assigned_specialist_id, dealers(region_codes(timezone_id, timezones(name)))')
    .eq('id', demandId)
    .single()

  if (demandError || !demand) return { success: false, error: 'Demand not found' }

  const smsSettings = await getSmsSettings()
  const trigger = smsSettings[messageType]
  if (!trigger.enabled) return { success: false, error: `SMS type "${messageType}" is disabled in settings` }

  let phone: string | null = null
  if (recipient === 'customer') {
    phone = demand.customer_phone
    if (!trigger.sendToCustomer) return { success: false, error: 'Sending to customer is disabled for this message type' }
  } else {
    if (!demand.assigned_specialist_id) return { success: false, error: 'No specialist assigned to this demand' }
    const { data: specialist } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', demand.assigned_specialist_id)
      .single()
    phone = specialist?.phone ?? null
    if (!phone) return { success: false, error: 'Specialist has no phone number' }
    const specialistAllowed = ['appointment_created', 'four_hour_reminder', 'cancellation_notice', 'rescheduling_notice']
    if (!specialistAllowed.includes(messageType)) {
      return { success: false, error: 'This message type cannot be sent to specialist' }
    }
    if (!('sendToSpecialist' in trigger) || !(trigger as { sendToSpecialist?: boolean }).sendToSpecialist) {
      return { success: false, error: 'Sending to specialist is disabled for this message type' }
    }
  }

  if (!phone) return { success: false, error: 'No phone number to send to' }

  const timezoneName = getTimezoneFromDealer(demand.dealers as Parameters<typeof getTimezoneFromDealer>[0]) ?? undefined
  const address = demand.customer_address || 'the specified location'
  const appointmentDate = new Date(demand.appointment_date)
  const now = new Date()
  const diffInHours = Math.floor((appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60))
  const hoursText = diffInHours === 1 ? '1 hour' : diffInHours <= 0 ? 'soon' : `${diffInHours} hours`

  let message: string
  switch (messageType) {
    case 'appointment_created':
      message = resolveAppointmentCreatedTemplate(trigger.template, {
        appointmentDate,
        address,
        timezoneName,
        signature: smsSettings.signature,
      })
      break
    case 'cancellation_notice':
    case 'rescheduling_notice':
      message = resolveCancellationTemplate(trigger.template, {
        phone: smsSettings.contactPhone,
        signature: smsSettings.signature,
      })
      break
    case 'four_hour_reminder':
      message = resolveReminderTemplate(trigger.template, {
        hoursText,
        address,
        signature: smsSettings.signature,
      })
      break
    default:
      return { success: false, error: 'Invalid message type' }
  }

  const result = await sendSMS(phone, message)
  if (result.success) {
    let recipientName: string | undefined
    if (recipient === 'customer') {
      recipientName = `${demand.customer_firstname} ${demand.customer_lastname}`.trim() || undefined
    } else if (demand.assigned_specialist_id) {
      const { data: spec } = await supabase.from('profiles').select('full_name').eq('id', demand.assigned_specialist_id).single()
      recipientName = (spec as { full_name?: string } | null)?.full_name
    }
    logSmsSent({
      phoneNumber: phone,
      recipientType: recipient,
      recipientName,
      demandId,
      messageType,
      triggeredBy: 'manual',
    }).catch(() => {})
    return { success: true }
  }
  return { success: false, error: (result as { error?: unknown }).error?.toString?.() ?? 'Failed to send SMS' }
}
