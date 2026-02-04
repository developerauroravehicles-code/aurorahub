'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getCameraModels() {
  const supabaseAdmin = createAdminClient()
  
  const { data, error } = await supabaseAdmin
    .from('camera_models')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })
  
  if (error) {
    console.error('Error fetching camera models:', error)
    return []
  }
  
  return data || []
}

export async function getAllCameraModels() {
  const supabaseAdmin = createAdminClient()
  
  const { data, error } = await supabaseAdmin
    .from('camera_models')
    .select('*')
    .order('name', { ascending: true })
  
  if (error) {
    console.error('Error fetching camera models:', error)
    return []
  }
  
  return data || []
}

export async function createCameraModel(formData: FormData): Promise<void> {
  const supabaseAdmin = createAdminClient()
  const name = formData.get('name') as string
  const description = formData.get('description') as string

  if (!name) {
    throw new Error('Camera model name is required')
  }

  const { error } = await supabaseAdmin.from('camera_models').insert({
    name: name.trim(),
    description: description?.trim() || null,
    is_active: true
  })

  if (error) {
    throw new Error(error.message)
  }
  
  revalidatePath('/dashboard/system-management/cameras')
}

export async function deleteCameraModel(id: string): Promise<void> {
  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin
    .from('camera_models')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
  
  revalidatePath('/dashboard/system-management/cameras')
}

export async function toggleCameraModelStatus(id: string, isActive: boolean): Promise<void> {
  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin
    .from('camera_models')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
  
  revalidatePath('/dashboard/system-management/cameras')
}

