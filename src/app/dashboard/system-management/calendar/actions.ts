'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCalendarSetting(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Check if user is Aurora Manager
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Managers can manage calendar settings' }
  }

  const dealerId = formData.get('dealerId') as string
  const dayType = formData.get('dayType') as string
  const startHour = parseInt(formData.get('startHour') as string)
  const endHour = parseInt(formData.get('endHour') as string)
  const slotIntervalMinutes = parseInt(formData.get('slotIntervalMinutes') as string)
  const appointmentDurationMinutes = parseInt(formData.get('appointmentDurationMinutes') as string)

  if (!dealerId || !dayType || isNaN(startHour) || isNaN(endHour) || isNaN(slotIntervalMinutes) || isNaN(appointmentDurationMinutes)) {
    return { success: false, error: 'Missing required fields' }
  }

  if (startHour >= endHour) {
    return { success: false, error: 'Start hour must be before end hour' }
  }

  // Check if setting already exists
  const { data: existing } = await supabase
    .from('dealer_calendar_settings')
    .select('id')
    .eq('dealer_id', dealerId)
    .eq('day_type', dayType)
    .single()

  if (existing) {
    return { success: false, error: 'Calendar setting for this dealer and day type already exists. Please update instead.' }
  }

  const { error } = await supabase
    .from('dealer_calendar_settings')
    .insert({
      dealer_id: dealerId,
      day_type: dayType,
      start_hour: startHour,
      end_hour: endHour,
      slot_interval_minutes: slotIntervalMinutes,
      appointment_duration_minutes: appointmentDurationMinutes
    })

  if (error) {
    console.error('Error creating calendar setting:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/system-management/calendar')
  return { success: true }
}

export async function updateCalendarSetting(
  settingId: string,
  startHour: number,
  endHour: number,
  slotIntervalMinutes: number,
  appointmentDurationMinutes: number
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Check if user is Aurora Manager
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Managers can manage calendar settings' }
  }

  if (startHour >= endHour) {
    return { success: false, error: 'Start hour must be before end hour' }
  }

  const { error } = await supabase
    .from('dealer_calendar_settings')
    .update({
      start_hour: startHour,
      end_hour: endHour,
      slot_interval_minutes: slotIntervalMinutes,
      appointment_duration_minutes: appointmentDurationMinutes
    })
    .eq('id', settingId)

  if (error) {
    console.error('Error updating calendar setting:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/system-management/calendar')
  return { success: true }
}

export async function deleteCalendarSetting(settingId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Check if user is Aurora Manager
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Managers can manage calendar settings' }
  }

  const { error } = await supabase
    .from('dealer_calendar_settings')
    .delete()
    .eq('id', settingId)

  if (error) {
    console.error('Error deleting calendar setting:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/system-management/calendar')
  return { success: true }
}

