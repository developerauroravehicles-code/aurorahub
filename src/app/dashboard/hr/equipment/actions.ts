'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function ensureAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', supabase: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'hr' && profile?.role !== 'aurora_manager') {
    return { error: 'Unauthorized', supabase: null }
  }
  return { supabase }
}

// Equipment types
export async function createEquipmentType(formData: { name: string; category?: string }) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('equipment_types').insert({
    name: formData.name.trim(),
    category: formData.category?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/equipment')
  return { success: true }
}

export async function updateEquipmentType(id: string, formData: { name?: string; category?: string }) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.name != null) update.name = formData.name.trim()
  if (formData.category != null) update.category = formData.category?.trim() || null
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('equipment_types').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/equipment')
  return { success: true }
}

export async function deleteEquipmentType(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('equipment_types').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/equipment')
  return { success: true }
}

// Equipment assignments
export async function createEquipmentAssignment(formData: {
  personnel_id: string
  equipment_type_id?: string
  item_name?: string
  serial_number?: string
  assigned_at: string
  condition?: string
  notes?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('equipment_assignments').insert({
    personnel_id: formData.personnel_id,
    equipment_type_id: formData.equipment_type_id || null,
    item_name: formData.item_name?.trim() || null,
    serial_number: formData.serial_number?.trim() || null,
    assigned_at: formData.assigned_at,
    condition: formData.condition?.trim() || null,
    notes: formData.notes?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/equipment')
  revalidatePath(`/dashboard/hr/personnel/${formData.personnel_id}`)
  return { success: true }
}

export async function updateEquipmentAssignment(
  id: string,
  formData: {
    equipment_type_id?: string
    item_name?: string
    serial_number?: string
    assigned_at?: string
    condition?: string
    notes?: string
  }
) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.equipment_type_id != null) update.equipment_type_id = formData.equipment_type_id || null
  if (formData.item_name != null) update.item_name = formData.item_name?.trim() || null
  if (formData.serial_number != null) update.serial_number = formData.serial_number?.trim() || null
  if (formData.assigned_at != null) update.assigned_at = formData.assigned_at
  if (formData.condition != null) update.condition = formData.condition?.trim() || null
  if (formData.notes != null) update.notes = formData.notes?.trim() || null
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('equipment_assignments').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/equipment')
  return { success: true }
}

export async function returnEquipment(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase
    .from('equipment_assignments')
    .update({ returned_at: new Date().toISOString().split('T')[0] })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/equipment')
  return { success: true }
}

export async function deleteEquipmentAssignment(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('equipment_assignments').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/equipment')
  return { success: true }
}
