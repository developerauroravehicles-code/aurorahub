'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { validateAppointmentSlot } from '@/app/dashboard/system-management/calendar/actions'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

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
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().optional(),
  vehicleMake: z.string().min(1),
  vehicleModel: z.string().min(1),
  vehicleYear: z.coerce.number().min(1900),
  stockNumber: z.string().min(1, 'Stock number is required'),
  cameraModel: z.string().min(1),
  appointmentDate: z.string().min(1, 'Please select a time slot'),
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
    cameraModel: formData.get('cameraModel'),
    appointmentDate: formData.get('appointmentDate'),
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
    camera_model: data.cameraModel,
    appointment_date: data.appointmentDate,
    status: 'pending_finance' as const,
    ...(profile.role === 'finance' && { assigned_finance_id: profile.id }),
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

  // SMS will be sent when finance approves the demand
  // Removed SMS sending from demand creation

  redirect(profile.role === 'finance' ? '/dashboard/finance/demands' : '/dashboard/sales/demands')
}

/**
 * Get appointment times already taken on a date (for that dealer).
 * When timezoneName is provided, the date is interpreted in the dealer's timezone so the same calendar day is used as in the slot list.
 */
export async function getTakenSlots(
  dateStr: string,
  dealerId?: string | null,
  timezoneName?: string | null
) {
  const supabase = await createClient()
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const y = match ? parseInt(match[1], 10) : 0
  const m = match ? parseInt(match[2], 10) : 1
  const d = match ? parseInt(match[3], 10) : 1

  let start: string
  let end: string
  if (timezoneName) {
    const startInTz = new Date(y, m - 1, d, 0, 0, 0)
    const endInTz = new Date(y, m - 1, d, 23, 59, 59, 999)
    start = fromZonedTime(startInTz, timezoneName).toISOString()
    end = fromZonedTime(endInTz, timezoneName).toISOString()
    } else {
      const [y, mo, d] = dateStr.split(/[T\s]/)[0].split('-').map(Number)
      const startInTz = new Date(y, (mo || 1) - 1, d || 1, 0, 0, 0)
      const endInTz = new Date(y, (mo || 1) - 1, d || 1, 23, 59, 59, 999)
      start = fromZonedTime(startInTz, SYSTEM_DEFAULT_TIMEZONE).toISOString()
      end = fromZonedTime(endInTz, SYSTEM_DEFAULT_TIMEZONE).toISOString()
    }

  let query = supabase
    .from('demands')
    .select('appointment_date')
    .gte('appointment_date', start)
    .lte('appointment_date', end)
    .neq('status', 'cancelled')
  if (dealerId) {
    query = query.eq('dealer_id', dealerId)
  }
  const { data } = await query

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
    
    // Get all non-cancelled appointments
    const { data, error } = await supabase
        .from('demands')
        .select('appointment_date')
        .neq('status', 'cancelled')
    
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
 * Check if a specific time slot is already taken for a dealer.
 * Single calendar per dealer: only one appointment per slot per dealer. Appointments are 75 minutes.
 * When timezoneName is provided, day boundaries use dealer timezone (fixes server-TZ mismatch).
 */
export async function isTimeSlotTaken(
  appointmentDate: string,
  dealerId: string | null,
  timezoneName?: string | null
): Promise<boolean> {
    if (!dealerId) return false
    const supabase = await createClient()
    const requestedTime = new Date(appointmentDate)
    const requestedStart = requestedTime.getTime()
    const requestedEnd = requestedStart + 75 * 60 * 1000

    let dayStart: string
    let dayEnd: string
    if (timezoneName) {
      const dateStr = formatInTimeZone(requestedTime, timezoneName, 'yyyy-MM-dd')
      const [y, mo, d] = dateStr.split('-').map(Number)
      const startInTz = new Date(y, mo - 1, d, 0, 0, 0)
      const endInTz = new Date(y, mo - 1, d, 23, 59, 59, 999)
      dayStart = fromZonedTime(startInTz, timezoneName).toISOString()
      dayEnd = fromZonedTime(endInTz, timezoneName).toISOString()
    } else {
      const dateStr = formatInTimeZone(requestedTime, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
      const [y, mo, d] = dateStr.split('-').map(Number)
      const startInTz = new Date(y, mo - 1, d, 0, 0, 0)
      const endInTz = new Date(y, mo - 1, d, 23, 59, 59, 999)
      dayStart = fromZonedTime(startInTz, SYSTEM_DEFAULT_TIMEZONE).toISOString()
      dayEnd = fromZonedTime(endInTz, SYSTEM_DEFAULT_TIMEZONE).toISOString()
    }

    const { data, error } = await supabase
        .from('demands')
        .select('appointment_date')
        .eq('dealer_id', dealerId)
        .gte('appointment_date', dayStart)
        .lte('appointment_date', dayEnd)
        .neq('status', 'cancelled')

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

