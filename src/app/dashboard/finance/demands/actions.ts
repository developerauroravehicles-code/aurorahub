'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logDemandChange } from '@/lib/demand-logger'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'
import { sendSMS } from '@/lib/twilio'
import { logSmsSent } from '@/lib/sms-logger'
import { getSmsSettings } from '@/lib/sms-resolver'
import { resolveAppointmentCreatedTemplate, resolveCancellationTemplate, resolveReminderTemplate } from '@/lib/sms-resolver'
import { validateAppointmentSlot } from '@/app/dashboard/system-management/calendar/actions'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'

export async function assignDemandToMe(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is finance
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'finance') {
    return { error: 'Only finance users can assign demands' }
  }

  // Check if demand is already assigned
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, status')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }
  
  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'This demand is already assigned to another finance user' }
  }

  if (demand.status !== 'pending_finance') {
    return { error: 'Only pending demands can be assigned' }
  }

  // Assign demand to current user
  const { error } = await supabase
    .from('demands')
    .update({ assigned_finance_id: user.id })
    .eq('id', demandId)

  if (error) return { error: error.message }

  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: 'pending_finance',
    newStatus: 'pending_finance',
    notes: 'Assigned to finance',
  }).catch(() => {})

  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function approveDemand(demandId: string, sendSMSToCustomer: boolean = false, sendSMSToSpecialist: boolean = false, sendSMSToAuroraManager: boolean = false) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is finance and demand is assigned to them
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, assigned_specialist_id, status, dealer_id, customer_phone, customer_firstname, customer_lastname, appointment_date, customer_address')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }

  if (demand.status !== 'pending_finance') {
    return { error: 'Only pending demands can be approved' }
  }

  // Check if demand is assigned to current user
  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'You can only approve demands assigned to you' }
  }

  // If not assigned, assign it first
  if (!demand.assigned_finance_id) {
    await supabase
      .from('demands')
      .update({ assigned_finance_id: user.id })
      .eq('id', demandId)
  }
  
  // Auto-assign to dealer's specialist if not already assigned
  // First try specialist_dealers (AURORAHQ model); then fallback to profiles.dealer_id
  let assignedSpecialistId = demand.assigned_specialist_id
  
  if (!assignedSpecialistId && demand.dealer_id) {
    const { data: sdRow } = await supabase
      .from('specialist_dealers')
      .select('specialist_id')
      .eq('dealer_id', demand.dealer_id)
      .limit(1)
      .maybeSingle()
    if (sdRow?.specialist_id) {
      assignedSpecialistId = sdRow.specialist_id
    }
  }
  if (!assignedSpecialistId) {
    const { data: dealerSpecialist } = await supabase
      .from('profiles')
      .select('id')
      .eq('dealer_id', demand.dealer_id)
      .eq('role', 'specialist')
      .limit(1)
      .single()
    if (dealerSpecialist) {
      assignedSpecialistId = dealerSpecialist.id
    }
  }

  // Update status and assign specialist if found
  const updateData: { status: string; assigned_specialist_id?: string } = { 
    status: 'approved' 
  }
  
  if (assignedSpecialistId) {
    updateData.assigned_specialist_id = assignedSpecialistId
  }

  const { error: updateError } = await supabase
    .from('demands')
    .update(updateData)
    .eq('id', demandId)

  if (updateError) return { error: updateError.message }

  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: 'pending_finance',
    newStatus: 'approved',
    notes: assignedSpecialistId ? 'Approved and specialist assigned' : 'Approved',
  }).catch(() => {})

  dispatchWebhooks(supabase, 'demand_approved', {
    demand_id: demandId,
    previous_status: 'pending_finance',
    new_status: 'approved',
    assigned_specialist_id: assignedSpecialistId ?? demand.assigned_specialist_id,
  }).catch(() => {})

  dispatchWebhooks(supabase, 'demand_status_change', {
    demand_id: demandId,
    previous_status: 'pending_finance',
    new_status: 'approved',
  }).catch(() => {})

  const smsSettings = await getSmsSettings()
  const ac = smsSettings.appointment_created

  // Send SMS to customer if requested and enabled in settings
  if (ac.enabled && ac.sendToCustomer && sendSMSToCustomer && demand.customer_phone) {
    try {
      const { data: dealer } = await supabase
        .from('dealers')
        .select('name, address, region_codes(timezone_id, timezones(name))')
        .eq('id', demand.dealer_id)
        .single()
      const appointmentDate = new Date(demand.appointment_date)
      const location = demand.customer_address || dealer?.address || dealer?.name || 'Authorized Dealer'
      const timezoneName = (dealer?.region_codes as any)?.timezones?.name || undefined
      const message = resolveAppointmentCreatedTemplate(ac.template, {
        appointmentDate,
        address: location,
        timezoneName,
        signature: smsSettings.signature,
      })
      const result = await sendSMS(demand.customer_phone, message)
      if (result.success) {
        logSmsSent({
          phoneNumber: demand.customer_phone,
          recipientType: 'customer',
          recipientName: `${demand.customer_firstname} ${demand.customer_lastname}`.trim(),
          demandId,
          messageType: 'appointment_created',
          triggeredBy: 'system',
          messageContent: message,
        }).catch(() => {})
      }
    } catch (smsError) {
      console.error('Failed to send SMS notification:', smsError)
    }
  }

  // Send SMS to assigned specialist if requested and enabled in settings
  const specialistIdToNotify = assignedSpecialistId || demand.assigned_specialist_id
  if (ac.enabled && ac.sendToSpecialist && sendSMSToSpecialist && specialistIdToNotify) {
    try {
      const { data: dealer } = await supabase
        .from('dealers')
        .select('name, address, region_codes(timezone_id, timezones(name))')
        .eq('id', demand.dealer_id)
        .single()
      const appointmentDate = new Date(demand.appointment_date)
      const location = demand.customer_address || dealer?.address || dealer?.name || 'Authorized Dealer'
      const timezoneName = (dealer?.region_codes as any)?.timezones?.name || undefined
      const message = resolveAppointmentCreatedTemplate(ac.template, {
        appointmentDate,
        address: location,
        timezoneName,
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
            demandId,
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

  // Send SMS to Aurora Manager(s) if requested and enabled in settings
  if (ac.enabled && ac.sendToAuroraManager && sendSMSToAuroraManager) {
    try {
      const { data: auroraManagers } = await supabase
        .from('profiles')
        .select('id, phone, full_name')
        .eq('role', 'aurora_manager')
        .not('phone', 'is', null)
      if (auroraManagers?.length) {
        const { data: dealer } = await supabase
          .from('dealers')
          .select('name, address, region_codes(timezone_id, timezones(name))')
          .eq('id', demand.dealer_id)
          .single()
        const appointmentDate = new Date(demand.appointment_date)
        const location = demand.customer_address || dealer?.address || dealer?.name || 'Authorized Dealer'
        const timezoneName = (dealer?.region_codes as { timezones?: { name: string } })?.timezones?.name || undefined
        const message = resolveAppointmentCreatedTemplate(ac.template, {
          appointmentDate,
          address: location,
          timezoneName,
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
                demandId,
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

  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function cancelDemand(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if demand is assigned to current user
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, status, appointment_date, customer_phone, customer_firstname, customer_lastname, assigned_specialist_id')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }

  // Only assigned finance users can cancel
  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'You can only cancel demands assigned to you' }
  }

  const { error } = await supabase
    .from('demands')
    .update({ status: 'cancelled' })
    .eq('id', demandId)
  
  if (error) return { error: error.message }

  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: demand.status as 'pending_finance' | 'approved',
    newStatus: 'cancelled',
    notes: 'Demand cancelled',
  }).catch(() => {})

  dispatchWebhooks(supabase, 'demand_cancelled', {
    demand_id: demandId,
    previous_status: demand.status,
    new_status: 'cancelled',
  }).catch(() => {})

  dispatchWebhooks(supabase, 'demand_status_change', {
    demand_id: demandId,
    previous_status: demand.status,
    new_status: 'cancelled',
  }).catch(() => {})
  
  // Send cancellation notice SMS when demand is cancelled (always, no 24h condition)
  const smsSettings = await getSmsSettings()
  const cn = smsSettings.cancellation_notice
  if (cn.enabled && (cn.sendToCustomer || cn.sendToSpecialist)) {
    const message = resolveCancellationTemplate(cn.template, {
      phone: smsSettings.contactPhone,
      signature: smsSettings.signature,
    })
    if (cn.sendToCustomer && demand.customer_phone) {
      try {
        const result = await sendSMS(demand.customer_phone, message)
        if (result.success) {
          logSmsSent({
            phoneNumber: demand.customer_phone,
            recipientType: 'customer',
            recipientName: `${demand.customer_firstname} ${demand.customer_lastname}`.trim(),
            demandId,
            messageType: 'cancellation_notice',
            triggeredBy: 'system',
            messageContent: message,
          }).catch(() => {})
        }
      } catch (smsError) {
        console.error('Failed to send cancellation SMS to customer:', smsError)
      }
    }
    if (cn.sendToSpecialist && (demand as { assigned_specialist_id?: string }).assigned_specialist_id) {
      try {
        const { data: specialist } = await supabase
          .from('profiles')
          .select('phone, full_name')
          .eq('id', (demand as { assigned_specialist_id?: string }).assigned_specialist_id)
          .single()
        if (specialist?.phone) {
          const result = await sendSMS(specialist.phone, message)
          if (result.success) {
            logSmsSent({
              phoneNumber: specialist.phone,
              recipientType: 'specialist',
              recipientName: specialist.full_name ?? undefined,
              demandId,
              messageType: 'cancellation_notice',
              triggeredBy: 'system',
              messageContent: message,
            }).catch(() => {})
          }
        }
      } catch (smsError) {
        console.error('Failed to send cancellation SMS to specialist:', smsError)
      }
    }
  }
  
  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateDemand(demandId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is finance
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'finance') {
    return { error: 'Only finance users can update demands' }
  }

  // Check if demand is assigned to current user
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, status, appointment_date, customer_phone, customer_firstname, customer_lastname, dealer_id, assigned_specialist_id, dealers(region_codes(timezone_id, timezones(name)))')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }

  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'You can only edit demands assigned to you' }
  }

  if (demand.status !== 'approved') {
    return { error: 'Only approved demands can be edited' }
  }

  // Get form data
  const customerFirstname = ((formData.get('customer_firstname') as string) ?? '').trim().toUpperCase()
  const customerLastname = ((formData.get('customer_lastname') as string) ?? '').trim().toUpperCase()
  const customerPhone = formData.get('customer_phone') as string
  const customerAddress = formData.get('customer_address') as string | null
  const vehicleMake = formData.get('vehicle_make') as string
  const vehicleModel = formData.get('vehicle_model') as string
  const vehicleYear = parseInt(formData.get('vehicle_year') as string)
  const stockNumberRaw = (formData.get('stock_number') as string)?.trim() || null
  const stockNumber = stockNumberRaw ? stockNumberRaw.toUpperCase() : null
  const cameraModel = formData.get('camera_model') as string
  const appointmentDate = formData.get('appointment_date') as string
  
  // Check if appointment date changed and if old date was within 24 hours
  const oldAppointmentDate = demand.appointment_date ? new Date(demand.appointment_date) : null
  const newAppointmentDate = new Date(appointmentDate)
  const appointmentDateChanged = oldAppointmentDate && oldAppointmentDate.getTime() !== newAppointmentDate.getTime()

  // Validate required fields
  if (!customerFirstname || !customerLastname || !customerPhone || !vehicleMake || !vehicleModel || !cameraModel || !appointmentDate) {
    return { error: 'All required fields must be filled' }
  }

  if (isNaN(vehicleYear) || vehicleYear < 1900) {
    return { error: 'Invalid vehicle year' }
  }

  if (demand.dealer_id) {
    const validation = await validateAppointmentSlot(demand.dealer_id, appointmentDate)
    if (!validation.valid) {
      return { error: validation.error ?? 'Selected appointment time is not available for this dealer.' }
    }
  }

  // Update demand
  const { error: updateError } = await supabase
    .from('demands')
    .update({
      customer_firstname: customerFirstname,
      customer_lastname: customerLastname,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      vehicle_make: vehicleMake,
      vehicle_model: vehicleModel,
      vehicle_year: vehicleYear,
      stock_number: stockNumber,
      camera_model: cameraModel,
      appointment_date: appointmentDate,
      updated_at: new Date().toISOString()
    })
    .eq('id', demandId)

  if (updateError) return { error: updateError.message }

  if (appointmentDateChanged) {
    logDemandChange({
      demandId,
      actorId: user.id,
      previousStatus: 'approved',
      newStatus: 'approved',
      notes: 'Appointment date rescheduled',
    }).catch(() => {})
  }

  // Send rescheduling notice SMS when appointment date changed (always, no 24h condition)
  const smsSettings = await getSmsSettings()
  const rn = smsSettings.rescheduling_notice
  if (rn.enabled && appointmentDateChanged && (rn.sendToCustomer || rn.sendToSpecialist)) {
    const timezoneName = getTimezoneFromDealer(demand.dealers as Parameters<typeof getTimezoneFromDealer>[0]) ?? undefined
    const message = resolveCancellationTemplate(rn.template, {
      phone: smsSettings.contactPhone,
      signature: smsSettings.signature,
      appointmentDate: new Date(appointmentDate),
      timezoneName,
    })
    if (rn.sendToCustomer && demand.customer_phone) {
      try {
        const result = await sendSMS(demand.customer_phone, message)
        if (result.success) {
          logSmsSent({
            phoneNumber: demand.customer_phone,
            recipientType: 'customer',
            recipientName: `${demand.customer_firstname} ${demand.customer_lastname}`.trim(),
            demandId,
            messageType: 'rescheduling_notice',
            triggeredBy: 'system',
            messageContent: message,
          }).catch(() => {})
        }
      } catch (smsError) {
        console.error('Failed to send rescheduling SMS to customer:', smsError)
      }
    }
    if (rn.sendToSpecialist && (demand as { assigned_specialist_id?: string }).assigned_specialist_id) {
      try {
        const { data: specialist } = await supabase
          .from('profiles')
          .select('phone, full_name')
          .eq('id', (demand as { assigned_specialist_id?: string }).assigned_specialist_id)
          .single()
        if (specialist?.phone) {
          const result = await sendSMS(specialist.phone, message)
          if (result.success) {
            logSmsSent({
              phoneNumber: specialist.phone,
              recipientType: 'specialist',
              recipientName: specialist.full_name ?? undefined,
              demandId,
              messageType: 'rescheduling_notice',
              triggeredBy: 'system',
              messageContent: message,
            }).catch(() => {})
          }
        }
      } catch (smsError) {
        console.error('Failed to send rescheduling SMS to specialist:', smsError)
      }
    }
  }

  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function revertDemandToPending(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is finance
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'finance') {
    return { error: 'Only finance users can revert demands' }
  }

  // Check if demand is assigned to current user
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, status')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }

  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'You can only revert demands assigned to you' }
  }

  if (demand.status !== 'approved') {
    return { error: 'Only approved demands can be reverted to pending' }
  }

  // Revert status to pending_finance
  const { error: updateError } = await supabase
    .from('demands')
    .update({ 
      status: 'pending_finance',
      updated_at: new Date().toISOString()
    })
    .eq('id', demandId)

  if (updateError) return { error: updateError.message }

  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: 'approved',
    newStatus: 'pending_finance',
    notes: 'Reverted to pending finance',
  }).catch(() => {})

  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

