'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { startOfDay, endOfDay, format } from 'date-fns'
import { sendSMS } from '@/lib/twilio'
import { validateAppointmentSlot } from '@/app/dashboard/system-management/calendar/actions'

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
  if (profile.role !== 'sales') return { error: 'Only sales users can create demands' }

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

  const slotTaken = await isTimeSlotTaken(data.appointmentDate, profile.dealer_id)
  if (slotTaken) {
      return { error: 'This time slot is already booked. Please select another time.' }
  }

  const { data: demand, error } = await supabase.from('demands').insert({
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
      status: 'pending_finance'
  }).select().single()

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

  redirect('/dashboard/sales/demands')
}

/** Get appointment times already taken on a date. When dealerId is set, only that dealer's appointments (single calendar per dealer). */
export async function getTakenSlots(dateStr: string, dealerId?: string | null) {
    const supabase = await createClient()
    const date = new Date(dateStr)
    const start = startOfDay(date).toISOString()
    const end = endOfDay(date).toISOString()

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
    return data.map(d => d.appointment_date)
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
 */
export async function isTimeSlotTaken(appointmentDate: string, dealerId: string | null): Promise<boolean> {
    if (!dealerId) return false
    const supabase = await createClient()
    const requestedTime = new Date(appointmentDate)
    const requestedStart = new Date(requestedTime)
    const requestedEnd = new Date(requestedTime.getTime() + 75 * 60 * 1000)
    const dayStart = startOfDay(requestedTime).toISOString()
    const dayEnd = endOfDay(requestedTime).toISOString()

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
        const existingStart = new Date(demand.appointment_date)
        const existingEnd = new Date(existingStart.getTime() + 75 * 60 * 1000)
        if (requestedStart < existingEnd && requestedEnd > existingStart) return true
    }
    return false
}

