'use server'

import { createClient } from '@/lib/supabase/server'
import { logDemandChange } from '@/lib/demand-logger'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { validateAppointmentSlot } from '@/app/dashboard/system-management/calendar/actions'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { isStockNumberDuplicate } from '@/lib/demand-stock'
import { lookupCameraModelId } from '@/lib/camera-model-resolve'

async function getDealerTimezone(dealerId: string | null): Promise<string | null> {
  if (!dealerId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('dealers')
    .select('region_codes(timezone_id, timezones(name))')
    .eq('id', dealerId)
    .single()
  return getTimezoneFromDealer(data as Parameters<typeof getTimezoneFromDealer>[0]) ?? null
}

const schema = z.object({
  firstName: z.string().min(1).transform(v => (v || '').trim().toUpperCase()),
  lastName: z.string().min(1).transform(v => (v || '').trim().toUpperCase()),
  phone: z.string().min(1),
  address: z.string().optional(),
  vehicleMake: z.string().min(1),
  vehicleModel: z.string().min(1),
  vehicleYear: z.coerce.number().min(1900),
  stockNumber: z.string().min(1, 'Stock number is required').transform(v => (v || '').trim().toUpperCase()),
  vinLast6: z.string().min(1, 'VIN last 6 digits is required').refine(
    v => (v || '').trim().replace(/\s/g, '').length >= 6,
    'VIN last 6 digits is required (at least 6 characters)'
  ).transform(v => (v || '').trim().replace(/\s/g, '').slice(-6).toUpperCase()),
  cameraModel: z.string().min(1),
  appointmentDate: z.string().min(1, 'Please select a time slot'),
  comment: z.string().optional(),
})

type ActionState = { error?: string; fieldErrors?: Record<string, string[]> } | null

export async function createDemand(prevState: ActionState, formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('id, dealer_id, role').eq('id', user.id).single()
  if (!profile) return { error: 'Profile not found' }
  if (!['sales', 'finance'].includes(profile.role)) {
    return { error: 'Only sales and finance users can create demands' }
  }

  const rawData = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    vehicleMake: formData.get('vehicleMake'),
    vehicleModel: formData.get('vehicleModel'),
    vehicleYear: formData.get('vehicleYear'),
    stockNumber: formData.get('stockNumber'),
    vinLast6: formData.get('vinLast6'),
    cameraModel: formData.get('cameraModel'),
    appointmentDate: formData.get('appointmentDate'),
    comment: formData.get('comment'),
  }

  const result = schema.safeParse(rawData)
  if (!result.success) {
      return { error: 'Validation failed', fieldErrors: result.error.flatten().fieldErrors }
  }

  const data = result.data

  if (!profile.dealer_id) {
    return { error: 'Your account is not assigned to a dealer.' }
  }

  const validation = await validateAppointmentSlot(profile.dealer_id, data.appointmentDate)
  if (!validation.valid) {
    return { error: validation.error ?? 'This time slot is not available.' }
  }

  const timezoneName = await getDealerTimezone(profile.dealer_id)
  const slotTaken = await isTimeSlotTaken(data.appointmentDate, profile.dealer_id, timezoneName)
  if (slotTaken) {
      return { error: 'This time slot is already booked. Please select another time.' }
  }

  const { duplicate: stockDuplicate } = await isStockNumberDuplicate(data.stockNumber)
  if (stockDuplicate) {
    return { error: `A demand with stock number "${data.stockNumber}" already exists. Please verify the stock number.` }
  }

  const cameraModelId = await lookupCameraModelId(supabase, data.cameraModel)

  const insertData = {
    created_by: profile.id,
    dealer_id: profile.dealer_id,
    customer_firstname: data.firstName,
    customer_lastname: data.lastName,
    customer_phone: data.phone,
    customer_address: data.address,
    vehicle_make: data.vehicleMake,
    vehicle_model: data.vehicleModel,
    vehicle_year: data.vehicleYear,
    stock_number: data.stockNumber,
    vin_last6: data.vinLast6,
    camera_model: data.cameraModel,
    ...(cameraModelId && { camera_model_id: cameraModelId }),
    appointment_date: data.appointmentDate,
    status: 'pending_finance' as const,
    ...(profile.role === 'finance' && { assigned_finance_id: profile.id }),
    ...(data.comment && data.comment.trim() && { comment: data.comment.trim() }),
  }

  const { data: demand, error } = await supabase.from('demands').insert(insertData).select().single()

  if (error) {
      console.error('Demand creation error:', error)
      // Check if error is related to overlapping appointments
      if (error.message && error.message.includes('time slot is already booked')) {
          return { error: 'This time slot is already booked. Please select another time.' }
      }
      return { error: error.message || 'Failed to create demand. Please check your permissions.' }
  }

  logDemandChange({
    demandId: demand.id,
    actorId: user.id,
    previousStatus: null,
    newStatus: 'pending_finance',
    notes: 'Demand created',
  }).catch(() => {})

  dispatchWebhooks(supabase, 'demand_created', {
    demand_id: demand.id,
    demand_number: demand.demand_number,
    status: demand.status,
    customer_firstname: demand.customer_firstname,
    customer_lastname: demand.customer_lastname,
    vehicle_make: demand.vehicle_make,
    vehicle_model: demand.vehicle_model,
    appointment_date: demand.appointment_date,
    dealer_id: demand.dealer_id,
  }).catch(() => {})

  // SMS will be sent when finance approves the demand
  // Removed SMS sending from demand creation

  redirect(profile.role === 'finance' ? '/dashboard/finance/demands' : '/dashboard/sales/demands')
}

/**
 * Get appointment times already taken on a date (across ALL dealers).
 * When any dealer books a slot, it is hidden from all other dealers - shared system.
 * Appointments are stored as Pacific Time (PT). dateStr is in Pacific (from calendar).
 */
export async function getTakenSlots(
  dateStr: string,
  _dealerId?: string | null,
  _timezoneName?: string | null
) {
  const supabase = await createClient()
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const y = match ? parseInt(match[1], 10) : 0
  const m = match ? parseInt(match[2], 10) : 1
  const d = match ? parseInt(match[3], 10) : 1

  const startInPT = new Date(y, m - 1, d, 0, 0, 0)
  const endInPT = new Date(y, m - 1, d, 23, 59, 59, 999)
  const start = fromZonedTime(startInPT, SYSTEM_DEFAULT_TIMEZONE).toISOString()
  const end = fromZonedTime(endInPT, SYSTEM_DEFAULT_TIMEZONE).toISOString()

  const { data } = await supabase
    .from('demands')
    .select('appointment_date')
    .gte('appointment_date', start)
    .lte('appointment_date', end)
    .neq('status', 'cancelled')

  if (!data || data.length === 0) return []
  return data.map((r: { appointment_date: string }) => r.appointment_date)
}

/**
 * Check if a specific slot overlaps with any existing appointment
 * Returns true if the slot is blocked (overlaps with an existing appointment)
 */
export async function isSlotBlocked(slotDate: string): Promise<boolean> {
    const supabase = await createClient()
    
    const slotTime = new Date(slotDate)
    const slotStart = new Date(slotTime)
    const slotEnd = new Date(slotTime.getTime() + 75 * 60 * 1000) // 75 minutes
    
    // Get all non-cancelled, non-external appointments
    const { data, error } = await supabase
        .from('demands')
        .select('appointment_date')
        .neq('status', 'cancelled')
        .or('is_external.is.null,is_external.eq.false')
    
    if (error || !data || data.length === 0) {
        return false
    }
    
    // Check for overlap with any existing appointment
    for (const demand of data) {
        const existingStart = new Date(demand.appointment_date)
        const existingEnd = new Date(existingStart.getTime() + 75 * 60 * 1000) // 75 minutes
        
        // Check if slots overlap
        if (slotStart < existingEnd && slotEnd > existingStart) {
            return true // Slot is blocked
        }
    }
    
    return false // Slot is available
}

/**
 * Check if a specific time slot is already taken (by ANY dealer).
 * Shared system: one slot taken = blocked for all dealers. Appointments are 75 minutes.
 */
export async function isTimeSlotTaken(
  appointmentDate: string,
  _dealerId: string | null,
  _timezoneName?: string | null
): Promise<boolean> {
    const supabase = await createClient()
    const requestedTime = new Date(appointmentDate)
    const requestedStart = requestedTime.getTime()
    const requestedEnd = requestedStart + 75 * 60 * 1000

    const dateStr = formatInTimeZone(requestedTime, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
    const [y, mo, d] = dateStr.split('-').map(Number)
    const dayStart = fromZonedTime(new Date(y, mo - 1, d, 0, 0, 0), SYSTEM_DEFAULT_TIMEZONE).toISOString()
    const dayEnd = fromZonedTime(new Date(y, mo - 1, d, 23, 59, 59, 999), SYSTEM_DEFAULT_TIMEZONE).toISOString()

    const { data, error } = await supabase
        .from('demands')
        .select('appointment_date')
        .gte('appointment_date', dayStart)
        .lte('appointment_date', dayEnd)
        .neq('status', 'cancelled')
        .or('is_external.is.null,is_external.eq.false')

    if (error) {
        console.error('Error checking time slot:', error)
        return false
    }
    if (!data || data.length === 0) return false

    for (const demand of data) {
        const existingStart = new Date(demand.appointment_date).getTime()
        const existingEnd = existingStart + 75 * 60 * 1000
        if (requestedStart < existingEnd && requestedEnd > existingStart) return true
    }
    return false
}

