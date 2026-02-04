'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createDealer(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const name = formData.get('name') as string
  const code = formData.get('code') as string
  const address = formData.get('address') as string
  const regionCodeId = formData.get('region_code_id') as string

  if (!name || !code) {
    throw new Error('Missing fields')
  }

  const dealerData: any = { name, code, address }
  if (regionCodeId && regionCodeId !== 'none') {
    dealerData.region_code_id = regionCodeId
  }

  const { error } = await supabase.from('dealers').insert(dealerData)
  if (error) {
    throw new Error(error.message)
  }
  
  revalidatePath('/dashboard/admin/system-management/region')
}

export async function createRegionCode(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const code = formData.get('code') as string
  const name = formData.get('name') as string
  const description = formData.get('description') as string

  if (!code || !name) {
    throw new Error('Code and name are required')
  }

  const { error } = await supabase.from('region_codes').insert({ 
    code, 
    name, 
    description: description || null 
  })
  
  if (error) {
    throw new Error(error.message)
  }
  
  revalidatePath('/dashboard/admin/system-management/region')
}

export async function updateDealerRegionCode(dealerId: string, regionCodeId: string | null): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  const updateData: any = {}
  if (regionCodeId && regionCodeId !== 'none') {
    updateData.region_code_id = regionCodeId
  } else {
    updateData.region_code_id = null
  }

  const { error } = await supabase
    .from('dealers')
    .update(updateData)
    .eq('id', dealerId)
  
  if (error) {
    console.error('Error updating dealer region code:', error)
    return { success: false, error: error.message }
  }
  
  revalidatePath('/dashboard/admin/system-management/region')
  return { success: true }
}

export async function updateRegionCode(regionCodeId: string, code: string, name: string, description: string | null): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('region_codes')
    .update({ 
      code, 
      name, 
      description: description || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', regionCodeId)
  
  if (error) {
    throw new Error(error.message)
  }
  
  revalidatePath('/dashboard/admin/system-management/region')
}

export async function deleteRegionCode(regionCodeId: string): Promise<void> {
  const supabase = await createClient()
  
  // First, remove region_code_id from all dealers using this region code
  await supabase
    .from('dealers')
    .update({ region_code_id: null })
    .eq('region_code_id', regionCodeId)
  
  // Then delete the region code
  const { error } = await supabase
    .from('region_codes')
    .delete()
    .eq('id', regionCodeId)
  
  if (error) {
    throw new Error(error.message)
  }
  
  revalidatePath('/dashboard/admin/system-management/region')
}

export async function addCameraToDealer(dealerId: string, cameraModelId: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('dealer_cameras')
    .insert({ dealer_id: dealerId, camera_model_id: cameraModelId })
  
  if (error) {
    throw new Error(error.message)
  }
  
  revalidatePath('/dashboard/admin/system-management/region')
}

export async function removeCameraFromDealer(dealerId: string, cameraModelId: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('dealer_cameras')
    .delete()
    .eq('dealer_id', dealerId)
    .eq('camera_model_id', cameraModelId)
  
  if (error) {
    throw new Error(error.message)
  }
  
  revalidatePath('/dashboard/admin/system-management/region')
}

export async function updateDealer(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const dealerId = formData.get('dealerId') as string
  const name = formData.get('name') as string
  const code = formData.get('code') as string
  const address = formData.get('address') as string
  const regionCodeId = formData.get('region_code_id') as string

  if (!dealerId || !name || !code) {
    throw new Error('Missing required fields')
  }

  const updateData: any = { name, code, address: address || null }
  if (regionCodeId && regionCodeId !== 'none') {
    updateData.region_code_id = regionCodeId
  } else {
    updateData.region_code_id = null
  }

  const { error } = await supabase
    .from('dealers')
    .update(updateData)
    .eq('id', dealerId)
  
  if (error) {
    throw new Error(error.message)
  }
  
  revalidatePath('/dashboard/admin/system-management/region')
}

export async function deleteDealer(dealerId: string): Promise<void> {
  const supabase = await createClient()
  
  // First, remove all camera assignments for this dealer
  await supabase
    .from('dealer_cameras')
    .delete()
    .eq('dealer_id', dealerId)
  
  // Then delete the dealer
  const { error } = await supabase
    .from('dealers')
    .delete()
    .eq('id', dealerId)
  
  if (error) {
    throw new Error(error.message)
  }
  
  revalidatePath('/dashboard/admin/system-management/region')
}

