'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { startOfDay, endOfDay, format } from 'date-fns'
import { sendSMS } from '@/lib/twilio'

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

  // Check if the time slot is already taken
  const slotTaken = await isTimeSlotTaken(data.appointmentDate)
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
      return { error: error.message || 'Failed to create demand. Please check your permissions.' }
  }

  // SMS will be sent when finance approves the demand
  // Removed SMS sending from demand creation

  redirect('/dashboard/sales/demands')
}

export async function getTakenSlots(dateStr: string) {
    const supabase = await createClient()
    // Ensure we parse correctly.
    const date = new Date(dateStr)
    const start = startOfDay(date).toISOString()
    const end = endOfDay(date).toISOString()

    const { data } = await supabase
        .from('demands')
        .select('appointment_date')
        .gte('appointment_date', start)
        .lte('appointment_date', end)
        .neq('status', 'cancelled')

    return data?.map(d => d.appointment_date) || []
}

/**
 * Check if a specific time slot is already taken
 * This ensures only one appointment per time slot
 * Appointments are 75 minutes long, so we check for any overlap
 */
export async function isTimeSlotTaken(appointmentDate: string): Promise<boolean> {
    const supabase = await createClient()
    
    // Parse the appointment date
    const requestedTime = new Date(appointmentDate)
    const requestedStart = new Date(requestedTime)
    const requestedEnd = new Date(requestedTime.getTime() + 75 * 60 * 1000) // 75 minutes
    
    // Get all non-cancelled appointments
    const { data, error } = await supabase
        .from('demands')
        .select('appointment_date')
        .neq('status', 'cancelled')
    
    if (error) {
        console.error('Error checking time slot:', error)
        return false // If error, allow creation (fail open)
    }
    
    if (!data || data.length === 0) {
        return false // No appointments, slot is available
    }
    
    // Check for any overlap with existing appointments
    for (const demand of data) {
        const existingStart = new Date(demand.appointment_date)
        const existingEnd = new Date(existingStart.getTime() + 75 * 60 * 1000) // 75 minutes
        
        // Check if there's any overlap between the requested slot and existing slot
        // Overlap occurs if: requestedStart < existingEnd && requestedEnd > existingStart
        if (requestedStart < existingEnd && requestedEnd > existingStart) {
            return true // Slot is taken (overlap detected)
        }
    }
    
    return false // Slot is available
}

