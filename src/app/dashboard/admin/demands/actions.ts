'use server'

import { createClient } from '@/lib/supabase/server'
import { isStockNumberDuplicate } from '@/lib/demand-stock'
import { revalidatePath } from 'next/cache'
import { logDemandChange, type DemandStatus } from '@/lib/demand-logger'
import { sendSMS } from '@/lib/twilio'
import { logSmsSent } from '@/lib/sms-logger'
import { getSmsSettings } from '@/lib/sms-resolver'
import { resolveCancellationTemplate } from '@/lib/sms-resolver'
import { validateAppointmentSlot } from '@/app/dashboard/system-management/calendar/actions'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { toDate } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { lookupCameraModelId } from '@/lib/camera-model-resolve'
import { assertDealerDemandAccess, canEditDemandCoreFields, getInventoryManagerDealerId } from '@/lib/inventory-manager-access'

type DemandEditProfile = {
  role: string
  dealer_id?: string | null
}

function authorizeCoreDemandEdit(
  profile: DemandEditProfile | null | undefined,
  demandDealerId?: string | null
): { error: string } | null {
  if (!profile || !canEditDemandCoreFields(profile.role)) {
    return { error: 'You do not have permission to edit this demand' }
  }

  if (demandDealerId !== undefined) {
    const access = assertDealerDemandAccess(profile, demandDealerId)
    if (!access.ok) return { error: access.error }
  }

  return null
}

export async function updateAssignedSpecialist(
  demandId: string,
  specialistId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Manager can change specialist assignment' }
  }

  const { data: demand } = await supabase
    .from('demands')
    .select('status')
    .eq('id', demandId)
    .single()

  const { error } = await supabase
    .from('demands')
    .update({ assigned_specialist_id: specialistId })
    .eq('id', demandId)

  if (error) return { success: false, error: error.message }

  const status: DemandStatus = (demand?.status ?? 'approved') as DemandStatus
  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: status,
    newStatus: status,
    notes: specialistId ? 'Specialist changed' : 'Specialist unassigned',
  }).catch(() => {})

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  return { success: true }
}

export async function updateAssignedFinance(
  demandId: string,
  financeId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Manager can change finance assignment' }
  }

  const { data: demand } = await supabase
    .from('demands')
    .select('status')
    .eq('id', demandId)
    .single()

  const { error } = await supabase
    .from('demands')
    .update({ assigned_finance_id: financeId })
    .eq('id', demandId)

  if (error) return { success: false, error: error.message }

  const status: DemandStatus = (demand?.status ?? 'pending_finance') as DemandStatus
  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: status,
    newStatus: status,
    notes: financeId ? 'Finance changed' : 'Finance unassigned',
  }).catch(() => {})

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  return { success: true }
}

export async function updateCustomerInfo(
  demandId: string,
  data: { firstName: string; lastName: string; phone: string; address?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, dealer_id')
    .eq('id', user.id)
    .single()

  const { data: demand } = await supabase
    .from('demands')
    .select('status, dealer_id')
    .eq('id', demandId)
    .single()

  const authError = authorizeCoreDemandEdit(profile, demand?.dealer_id)
  if (authError) return { success: false, error: authError.error }

  const firstName = (data.firstName || '').trim().toUpperCase()
  const lastName = (data.lastName || '').trim().toUpperCase()
  const phone = (data.phone || '').trim()
  if (!firstName || !lastName || !phone) {
    return { success: false, error: 'First name, last name and phone are required' }
  }

  const { error } = await supabase
    .from('demands')
    .update({
      customer_firstname: firstName,
      customer_lastname: lastName,
      customer_phone: phone,
      customer_address: (data.address || '').trim() || null,
    })
    .eq('id', demandId)

  if (error) return { success: false, error: error.message }

  const status: DemandStatus = (demand?.status ?? 'pending_finance') as DemandStatus
  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: status,
    newStatus: status,
    notes: 'Customer information updated',
  }).catch(() => {})

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  return { success: true }
}

export async function updateVinLast6(
  demandId: string,
  vinLast6: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, dealer_id')
    .eq('id', user.id)
    .single()

  const normalized = (vinLast6 || '').trim().replace(/\s/g, '').slice(-6).toUpperCase()
  if (normalized.length < 6) {
    return { success: false, error: 'VIN last 6 digits is required (exactly 6 characters)' }
  }

  const { data: demand } = await supabase
    .from('demands')
    .select('status, dealer_id')
    .eq('id', demandId)
    .single()

  const authError = authorizeCoreDemandEdit(profile, demand?.dealer_id)
  if (authError) return { success: false, error: authError.error }

  const { error } = await supabase
    .from('demands')
    .update({ vin_last6: normalized })
    .eq('id', demandId)

  if (error) return { success: false, error: error.message }

  const status: DemandStatus = (demand?.status ?? 'pending_finance') as DemandStatus
  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: status,
    newStatus: status,
    notes: 'VIN last 6 digits updated',
  }).catch(() => {})

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  return { success: true }
}

export async function updateStockNumber(
  demandId: string,
  stockNumber: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, dealer_id')
    .eq('id', user.id)
    .single()

  const trimmed = (stockNumber || '').trim().toUpperCase()

  const { data: demand } = await supabase
    .from('demands')
    .select('status, dealer_id')
    .eq('id', demandId)
    .single()

  const authError = authorizeCoreDemandEdit(profile, demand?.dealer_id)
  if (authError) return { success: false, error: authError.error }

  if (trimmed) {
    const dealerScope = getInventoryManagerDealerId(profile) ?? undefined
    const { duplicate } = await isStockNumberDuplicate(trimmed, demandId, dealerScope)
    if (duplicate) {
      return { success: false, error: `A demand with stock number "${trimmed}" already exists. Please verify the stock number.` }
    }
  }

  const { error } = await supabase
    .from('demands')
    .update({ stock_number: trimmed || null })
    .eq('id', demandId)

  if (error) return { success: false, error: error.message }

  const status: DemandStatus = (demand?.status ?? 'pending_finance') as DemandStatus
  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: status,
    newStatus: status,
    notes: 'Stock number updated',
  }).catch(() => {})

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  return { success: true }
}

export async function updateDemandByAuroraManager(
  demandId: string,
  formData: FormData,
  options: { sendToCustomer?: boolean; sendToSpecialist?: boolean } = {}
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role, dealer_id').eq('id', user.id).single()

  const { data: demand } = await supabase
    .from('demands')
    .select('dealer_id, status, appointment_date, customer_phone, customer_firstname, customer_lastname, assigned_specialist_id, is_external, dealers(region_codes(timezone_id, timezones(name)))')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }

  const authError = authorizeCoreDemandEdit(profile, demand.dealer_id)
  if (authError) return { error: authError.error }

  if (demand.status === 'cancelled') return { error: 'Cannot update a cancelled demand' }

  const customerFirstname = ((formData.get('customer_firstname') as string) ?? '').trim().toUpperCase()
  const customerLastname = ((formData.get('customer_lastname') as string) ?? '').trim().toUpperCase()
  const customerPhone = (formData.get('customer_phone') as string)?.trim()
  const customerAddress = (formData.get('customer_address') as string)?.trim() || null
  const vehicleMake = (formData.get('vehicle_make') as string)?.trim()
  const vehicleModel = (formData.get('vehicle_model') as string)?.trim()
  const vehicleYear = parseInt(formData.get('vehicle_year') as string, 10)
  const stockNumberRaw = (formData.get('stock_number') as string)?.trim() || null
  const stockNumber = stockNumberRaw ? stockNumberRaw.toUpperCase() : null
  const cameraModel = (formData.get('camera_model') as string)?.trim()
  let appointmentDate = formData.get('appointment_date') as string

  if (!customerFirstname || !customerLastname || !customerPhone || !vehicleMake || !vehicleModel || !cameraModel) {
    return { error: 'All required fields must be filled' }
  }
  if (isNaN(vehicleYear) || vehicleYear < 1900) return { error: 'Invalid vehicle year' }

  const isExternal = !!demand.is_external

  if (isExternal && formData.get('appointment_date_date')) {
    const dateStr = formData.get('appointment_date_date') as string
    const timezoneName = getTimezoneFromDealer(demand.dealers as Parameters<typeof getTimezoneFromDealer>[0]) ?? SYSTEM_DEFAULT_TIMEZONE
    const atLocalNoon = toDate(`${dateStr}T12:00:00`, { timeZone: timezoneName })
    if (Number.isNaN(atLocalNoon.getTime())) {
      return { error: 'Invalid appointment date' }
    }
    appointmentDate = atLocalNoon.toISOString()
  }

  if (!appointmentDate) return { error: 'Appointment date is required' }

  if (stockNumber) {
    const dealerScope = getInventoryManagerDealerId(profile) ?? undefined
    const { duplicate } = await isStockNumberDuplicate(stockNumber, demandId, dealerScope)
    if (duplicate) {
      return { error: `A demand with stock number "${stockNumber}" already exists. Please verify the stock number.` }
    }
  }

  if (demand.dealer_id && !isExternal) {
    const validation = await validateAppointmentSlot(demand.dealer_id, appointmentDate)
    if (!validation.valid) {
      return { error: validation.error ?? 'Selected appointment time is not available.' }
    }
  }

  const oldAppointmentDate = demand.appointment_date ? new Date(demand.appointment_date) : null
  const newAppointmentDate = new Date(appointmentDate)
  const appointmentDateChanged = oldAppointmentDate && oldAppointmentDate.getTime() !== newAppointmentDate.getTime()

  const cameraModelId = await lookupCameraModelId(supabase, cameraModel)

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
      camera_model_id: cameraModelId,
      appointment_date: appointmentDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', demandId)

  if (updateError) return { error: updateError.message }

  const status: DemandStatus = (demand?.status ?? 'pending_finance') as DemandStatus
  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: status,
    newStatus: status,
    notes: appointmentDateChanged ? 'Appointment rescheduled' : 'Demand updated',
  }).catch(() => {})

  if (appointmentDateChanged && (options.sendToCustomer || options.sendToSpecialist)) {
    const smsSettings = await getSmsSettings()
    const rn = smsSettings.rescheduling_notice
    if (rn.enabled) {
      const timezoneName = getTimezoneFromDealer(demand.dealers as Parameters<typeof getTimezoneFromDealer>[0]) ?? undefined
      const message = resolveCancellationTemplate(rn.template, {
        phone: smsSettings.contactPhone,
        signature: smsSettings.signature,
        appointmentDate: newAppointmentDate,
        timezoneName,
      })
      if (options.sendToCustomer && rn.sendToCustomer && demand.customer_phone) {
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
        } catch (e) {
          console.error('Failed to send rescheduling SMS to customer:', e)
        }
      }
      if (options.sendToSpecialist && rn.sendToSpecialist && demand.assigned_specialist_id) {
        try {
          const { data: specialist } = await supabase
            .from('profiles')
            .select('phone, full_name')
            .eq('id', demand.assigned_specialist_id)
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
        } catch (e) {
          console.error('Failed to send rescheduling SMS to specialist:', e)
        }
      }
    }
  }

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  return {}
}

export async function deleteDemand(demandId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can delete demands' }
  }

  const { error } = await supabase.from('demands').delete().eq('id', demandId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/demands')
  return {}
}

/**
 * Set completed_at from appointment_date so statements / monthly reports match the retroactive job date.
 */
export async function alignDemandCompletedAtToAppointmentDate(demandId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can update completion date' }
  }

  const { data: row } = await supabase
    .from('demands')
    .select('status, appointment_date')
    .eq('id', demandId)
    .single()

  if (!row || row.status !== 'completed') return { error: 'Only completed demands can be aligned' }
  if (!row.appointment_date) return { error: 'Missing appointment date' }

  const { error } = await supabase.from('demands').update({ completed_at: row.appointment_date }).eq('id', demandId)

  if (error) return { error: error.message }

  logDemandChange({
    demandId,
    actorId: user.id,
    previousStatus: 'completed',
    newStatus: 'completed',
    notes: 'completed_at aligned to appointment_date (reporting / statements)',
  }).catch(() => {})

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  revalidatePath('/dashboard/admin/statements')
  revalidatePath('/dashboard/admin/invoices')
  return {}
}
