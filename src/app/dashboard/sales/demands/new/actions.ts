'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { startOfDay, endOfDay } from 'date-fns'

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().optional(),
  vehicleMake: z.string().min(1),
  vehicleModel: z.string().min(1),
  vehicleYear: z.coerce.number().min(1900),
  cameraModel: z.string().min(1),
  appointmentDate: z.string().min(1, 'Please select a time slot'),
})

export async function createDemand(prevState: any, formData: FormData) {
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
    cameraModel: formData.get('cameraModel'),
    appointmentDate: formData.get('appointmentDate'),
  }

  const result = schema.safeParse(rawData)
  if (!result.success) {
      return { error: 'Validation failed', fieldErrors: result.error.flatten().fieldErrors }
  }

  const data = result.data

  const { error } = await supabase.from('demands').insert({
      created_by: profile.id,
      dealer_id: profile.dealer_id,
      customer_firstname: data.firstName,
      customer_lastname: data.lastName,
      customer_phone: data.phone,
      customer_address: data.address,
      vehicle_make: data.vehicleMake,
      vehicle_model: data.vehicleModel,
      vehicle_year: data.vehicleYear,
      camera_model: data.cameraModel,
      appointment_date: data.appointmentDate,
      status: 'pending_finance'
  })

  if (error) {
      console.error('Demand creation error:', error)
      return { error: error.message || 'Failed to create demand. Please check your permissions.' }
  }

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

