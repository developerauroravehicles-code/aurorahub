'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseWarrantyYearsFromForm } from '@/lib/warranty-period'

async function verifyAuroraManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['aurora_manager', 'it'].includes(profile?.role ?? '')) {
    throw new Error('Unauthorized: Only Aurora Manager or IT can access System Management')
  }
}

export async function createDealer(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
    const supabase = await createClient()
    const name = formData.get('name') as string
    const code = formData.get('code') as string
    const address = formData.get('address') as string
    const phone = formData.get('phone') as string
    const regionCodeId = formData.get('region_code_id') as string

    if (!name || !code) {
      return { success: false, error: 'Missing fields' }
    }

    const dealerData: {
      name: string
      code: string
      address?: string
      phone?: string
      region_code_id?: string
      warranty_years: number
    } = {
      name,
      code,
      address: address || undefined,
      phone: phone?.trim() || undefined,
      warranty_years: parseWarrantyYearsFromForm(formData.get('warranty_years')),
    }
    if (regionCodeId && regionCodeId !== 'none') {
      dealerData.region_code_id = regionCodeId
    }

    const { error } = await supabase.from('dealers').insert(dealerData)
    if (error) {
      return { success: false, error: error.message }
    }
    
    revalidatePath('/dashboard/configuration/dealers')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create dealer' }
  }
}

export async function createRegionCode(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
    const supabase = await createClient()
    const code = formData.get('code') as string
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const timezoneId = formData.get('timezone_id') as string

    if (!code || !name) {
      return { success: false, error: 'Code and name are required' }
    }

    const insertData: { code: string; name: string; description: string | null; timezone_id?: string | null } = { 
      code, 
      name, 
      description: description || null 
    }

    if (timezoneId && timezoneId !== 'none') {
      insertData.timezone_id = timezoneId
    } else {
      insertData.timezone_id = null
    }

    const { error } = await supabase.from('region_codes').insert(insertData)
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    revalidatePath('/dashboard/configuration/region')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create region code' }
  }
}

export async function updateDealerRegionCode(dealerId: string, regionCodeId: string | null): Promise<{ success: boolean; error?: string }> {
  await verifyAuroraManager()
  const supabase = await createClient()
  
  const updateData: { region_code_id: string | null } = { region_code_id: null }
  if (regionCodeId && regionCodeId !== 'none') {
    updateData.region_code_id = regionCodeId
  }

  const { error } = await supabase
    .from('dealers')
    .update(updateData)
    .eq('id', dealerId)
  
  if (error) {
    console.error('Error updating dealer region code:', error)
    return { success: false, error: error.message }
  }
  
  revalidatePath('/dashboard/configuration/dealers')
  return { success: true }
}

export async function updateRegionCode(regionCodeId: string, code: string, name: string, description: string | null, timezoneId: string | null): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
    const supabase = await createClient()
    
    const updateData: { code: string; name: string; description: string | null; timezone_id: string | null; updated_at: string } = { 
      code, 
      name, 
      description: description || null,
      timezone_id: timezoneId || null,
      updated_at: new Date().toISOString()
    }
    
    const { error } = await supabase
      .from('region_codes')
      .update(updateData)
      .eq('id', regionCodeId)
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    revalidatePath('/dashboard/configuration/region')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update region code' }
  }
}

export async function deleteRegionCode(regionCodeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
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
      return { success: false, error: error.message }
    }
    
    revalidatePath('/dashboard/configuration/region')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete region code' }
  }
}

export async function addCameraToDealer(dealerId: string, cameraModelId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('dealer_cameras')
      .insert({ dealer_id: dealerId, camera_model_id: cameraModelId })
    
    if (error) {
      // If already exists, return success (idempotent)
      if (error.code === '23505') {
        return { success: true }
      }
      return { success: false, error: error.message }
    }

    const { notifyCameraDealerAssignment } = await import('@/lib/camera-dealer-notify')
    notifyCameraDealerAssignment('assigned', dealerId, cameraModelId).catch(() => {})

    revalidatePath('/dashboard/configuration/dealers')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add camera to dealer' }
  }
}

export async function removeCameraFromDealer(dealerId: string, cameraModelId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('dealer_cameras')
      .delete()
      .eq('dealer_id', dealerId)
      .eq('camera_model_id', cameraModelId)
    
    if (error) {
      return { success: false, error: error.message }
    }

    const { notifyCameraDealerAssignment } = await import('@/lib/camera-dealer-notify')
    notifyCameraDealerAssignment('removed', dealerId, cameraModelId).catch(() => {})

    revalidatePath('/dashboard/configuration/dealers')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to remove camera from dealer' }
  }
}

export async function updateDealer(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
    const supabase = await createClient()
    const dealerId = formData.get('dealerId') as string
    const name = formData.get('name') as string
    const code = formData.get('code') as string
    const address = formData.get('address') as string
    const phone = formData.get('phone') as string
    const regionCodeId = formData.get('region_code_id') as string
    const inventoryRegionId = formData.get('inventory_region_id') as string

    if (!dealerId || !name || !code) {
      return { success: false, error: 'Missing required fields' }
    }

    const updateData: {
      name: string
      code: string
      address: string | null
      phone: string | null
      region_code_id: string | null
      inventory_region_id: string | null
      warranty_years: number
    } = {
      name,
      code,
      address: address || null,
      phone: phone?.trim() || null,
      region_code_id: null,
      inventory_region_id: null,
      warranty_years: parseWarrantyYearsFromForm(formData.get('warranty_years')),
    }
    if (regionCodeId && regionCodeId !== 'none') {
      updateData.region_code_id = regionCodeId
    }
    if (inventoryRegionId && inventoryRegionId !== 'none') {
      updateData.inventory_region_id = inventoryRegionId
    }

    const { error } = await supabase
      .from('dealers')
      .update(updateData)
      .eq('id', dealerId)
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    revalidatePath('/dashboard/configuration/dealers')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update dealer' }
  }
}

export async function deleteDealer(dealerId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
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
      return { success: false, error: error.message }
    }
    
    revalidatePath('/dashboard/configuration/dealers')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete dealer' }
  }
}

export async function addDealerInvoiceEmail(
  dealerId: string,
  email: string,
  label?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
    const supabase = await createClient()
    const normalized = email.trim().toLowerCase()
    if (!normalized || !normalized.includes('@')) {
      return { success: false, error: 'Valid email is required' }
    }

    const { error } = await supabase.from('dealer_invoice_emails').insert({
      dealer_id: dealerId,
      email: normalized,
      label: label?.trim() || null,
    })

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/configuration/dealers')
    revalidatePath('/dashboard/admin/daily-invoices')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add email',
    }
  }
}

export async function removeDealerInvoiceEmail(emailId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
    const supabase = await createClient()

    const { error } = await supabase.from('dealer_invoice_emails').delete().eq('id', emailId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/configuration/dealers')
    revalidatePath('/dashboard/admin/daily-invoices')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove email',
    }
  }
}

