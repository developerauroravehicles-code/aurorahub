import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { logDemandChange } from '@/lib/demand-logger'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'
import { isDemoSmsPhone, sendSMS } from '@/lib/twilio'
import { logSmsSent } from '@/lib/sms-logger'
import { getSmsSettings } from '@/lib/sms-resolver'
import { buildCustomerSmsMessage, buildSpecialistSmsMessage } from '@/lib/sms-message-builder'
import { notifyAuroraManagersSmsFailed } from '@/lib/notify-sms-failed'
import { isSpecialistDoubleBooked } from '@/lib/scheduling-pool'

export type DemandApprovalSmsContext = {
  dealer_id: string | null
  customer_phone: string
  customer_firstname: string
  customer_lastname: string
  appointment_date: string | null
  customer_address: string | null
  vehicle_year: number | null
  vehicle_make: string | null
  vehicle_model: string | null
  vin_last6: string | null
  stock_number: string | null
  assigned_specialist_id?: string | null
}

export type DemandApprovalSmsFlags = {
  customer: boolean
  specialist: boolean
  auroraManager: boolean
}

const DEFAULT_SMS_FLAGS: DemandApprovalSmsFlags = {
  customer: true,
  specialist: true,
  auroraManager: true,
}

export async function resolveAssignedSpecialistForDemand(
  supabase: SupabaseClient,
  input: {
    dealerId: string
    appointmentDate: string | null
    excludeDemandId: string
    existingSpecialistId?: string | null
  }
): Promise<string | null> {
  let assignedSpecialistId = input.existingSpecialistId ?? null

  if (!assignedSpecialistId) {
    const { data: sdRow } = await supabase
      .from('specialist_dealers')
      .select('specialist_id')
      .eq('dealer_id', input.dealerId)
      .limit(1)
      .maybeSingle()
    if (sdRow?.specialist_id) assignedSpecialistId = sdRow.specialist_id
  }

  if (!assignedSpecialistId) {
    const { data: dealerSpecialist } = await supabase
      .from('profiles')
      .select('id')
      .eq('dealer_id', input.dealerId)
      .eq('role', 'specialist')
      .limit(1)
      .maybeSingle()
    if (dealerSpecialist?.id) assignedSpecialistId = dealerSpecialist.id
  }

  if (assignedSpecialistId && input.appointmentDate) {
    const doubleBooked = await isSpecialistDoubleBooked(
      supabase,
      assignedSpecialistId,
      input.appointmentDate,
      { excludeDemandId: input.excludeDemandId }
    )
    if (doubleBooked) assignedSpecialistId = null
  }

  return assignedSpecialistId
}

export async function finalizeDemandAsApproved(
  supabase: SupabaseClient,
  input: {
    demandId: string
    actorId: string
    demand: DemandApprovalSmsContext
    previousStatus: string | null
    logNote?: string
    sms?: Partial<DemandApprovalSmsFlags>
    /** When set, atomically moves pending_finance → approved. When null, demand is already approved. */
    transitionFromStatus?: 'pending_finance' | null
  }
): Promise<{ success: true; assignedSpecialistId: string | null } | { error: string }> {
  const smsFlags = { ...DEFAULT_SMS_FLAGS, ...input.sms }
  const dealerId = input.demand.dealer_id
  if (!dealerId) return { error: 'Demand has no dealer.' }

  const assignedSpecialistId = await resolveAssignedSpecialistForDemand(supabase, {
    dealerId,
    appointmentDate: input.demand.appointment_date,
    excludeDemandId: input.demandId,
    existingSpecialistId: input.demand.assigned_specialist_id,
  })

  if (input.transitionFromStatus === 'pending_finance') {
    const updateData: { status: string; assigned_specialist_id?: string } = { status: 'approved' }
    if (assignedSpecialistId) updateData.assigned_specialist_id = assignedSpecialistId

    const { data: updated, error: updateError } = await supabase
      .from('demands')
      .update(updateData)
      .eq('id', input.demandId)
      .eq('status', 'pending_finance')
      .select('id')
      .single()

    if (updateError) return { error: updateError.message }
    if (!updated) return { error: 'Demand was already approved or no longer pending' }
  } else if (assignedSpecialistId && !input.demand.assigned_specialist_id) {
    await supabase
      .from('demands')
      .update({ assigned_specialist_id: assignedSpecialistId })
      .eq('id', input.demandId)
  }

  const prevForWebhook = input.previousStatus === null ? 'created' : input.previousStatus
  logDemandChange({
    demandId: input.demandId,
    actorId: input.actorId,
    previousStatus: input.previousStatus as 'pending_finance' | null,
    newStatus: 'approved',
    notes: input.logNote ?? (assignedSpecialistId ? 'Approved and specialist assigned' : 'Approved'),
  }).catch(() => {})

  dispatchWebhooks(supabase, 'demand_approved', {
    demand_id: input.demandId,
    previous_status: prevForWebhook,
    new_status: 'approved',
    assigned_specialist_id: assignedSpecialistId ?? input.demand.assigned_specialist_id,
  }).catch(() => {})

  dispatchWebhooks(supabase, 'demand_status_change', {
    demand_id: input.demandId,
    previous_status: prevForWebhook,
    new_status: 'approved',
  }).catch(() => {})

  const smsSettings = await getSmsSettings()
  const ac = smsSettings.appointment_created
  const adminForSms = createAdminClient()

  const { data: dealerForSms } = await supabase
    .from('dealers')
    .select('name, address, region_codes(timezone_id, timezones(name))')
    .eq('id', dealerId)
    .single()

  const timezoneName = (dealerForSms?.region_codes as { timezones?: { name: string } } | null)?.timezones?.name
  const dealerCtx = {
    name: dealerForSms?.name,
    address: dealerForSms?.address,
    timezoneName,
  }

  const customerIsDemo = isDemoSmsPhone(input.demand.customer_phone)

  if (ac.enabled && ac.sendToCustomer && smsFlags.customer && input.demand.customer_phone && !customerIsDemo) {
    try {
      const message = buildCustomerSmsMessage('appointment_created', ac, input.demand, dealerCtx, {
        contactPhone: smsSettings.contactPhone,
        signature: smsSettings.signature,
      })
      const result = await sendSMS(input.demand.customer_phone, message)
      if (result.success) {
        logSmsSent({
          phoneNumber: input.demand.customer_phone,
          recipientType: 'customer',
          recipientName: `${input.demand.customer_firstname} ${input.demand.customer_lastname}`.trim(),
          demandId: input.demandId,
          messageType: 'appointment_created',
          triggeredBy: 'system',
          messageContent: message,
        }).catch(() => {})
      } else {
        notifyAuroraManagersSmsFailed(
          adminForSms,
          input.demandId,
          'appointment_created',
          'Send failed',
          input.demand.customer_phone
        ).catch(() => {})
      }
    } catch {
      notifyAuroraManagersSmsFailed(
        adminForSms,
        input.demandId,
        'appointment_created',
        'Send error',
        input.demand.customer_phone
      ).catch(() => {})
    }
  } else if (
    smsFlags.customer &&
    input.demand.customer_phone &&
    !customerIsDemo &&
    (!ac.enabled || !ac.sendToCustomer)
  ) {
    notifyAuroraManagersSmsFailed(
      adminForSms,
      input.demandId,
      'appointment_created',
      'Disabled in SMS settings',
      input.demand.customer_phone
    ).catch(() => {})
  }

  const specialistIdToNotify = assignedSpecialistId ?? input.demand.assigned_specialist_id
  if (ac.enabled && ac.sendToSpecialist && smsFlags.specialist && specialistIdToNotify) {
    try {
      const message = buildSpecialistSmsMessage('appointment_created', ac, input.demand, dealerCtx, {
        contactPhone: smsSettings.contactPhone,
        signature: smsSettings.signature,
      })
      const { data: specialist } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('id', specialistIdToNotify)
        .single()
      if (specialist?.phone) {
        const result = await sendSMS(specialist.phone, message)
        if (result.success) {
          logSmsSent({
            phoneNumber: specialist.phone,
            recipientType: 'specialist',
            recipientName: specialist.full_name ?? undefined,
            demandId: input.demandId,
            messageType: 'appointment_created',
            triggeredBy: 'system',
            messageContent: message,
          }).catch(() => {})
        }
      }
    } catch (smsError) {
      console.error('Failed to send SMS to specialist:', smsError)
    }
  }

  if (ac.enabled && ac.sendToAuroraManager && smsFlags.auroraManager) {
    try {
      const { data: auroraManagers } = await supabase
        .from('profiles')
        .select('id, phone, full_name')
        .eq('role', 'aurora_manager')
        .not('phone', 'is', null)
      if (auroraManagers?.length) {
        const message = buildCustomerSmsMessage('appointment_created', ac, input.demand, dealerCtx, {
          contactPhone: smsSettings.contactPhone,
          signature: smsSettings.signature,
        })
        for (const am of auroraManagers) {
          if (am.phone) {
            const result = await sendSMS(am.phone, message)
            if (result.success) {
              logSmsSent({
                phoneNumber: am.phone,
                recipientType: 'aurora_manager',
                recipientName: am.full_name ?? undefined,
                demandId: input.demandId,
                messageType: 'appointment_created',
                triggeredBy: 'system',
                messageContent: message,
              }).catch(() => {})
            }
          }
        }
      }
    } catch (smsError) {
      console.error('Failed to send SMS to Aurora Manager:', smsError)
    }
  }

  return { success: true, assignedSpecialistId }
}