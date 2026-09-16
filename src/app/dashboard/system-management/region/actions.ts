'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

    const { data: lastRow } = await supabase
      .from('dealer_cameras')
      .select('sort_order')
      .eq('dealer_id', dealerId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextSortOrder =
      (typeof lastRow?.sort_order === 'number' ? lastRow.sort_order : Number(lastRow?.sort_order ?? 0)) + 10

    const { error } = await supabase
      .from('dealer_cameras')
      .insert({ dealer_id: dealerId, camera_model_id: cameraModelId, sort_order: nextSortOrder })
    
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

function revalidateDealerCameraBookingPaths() {
  revalidatePath('/dashboard/system-management/dealer')
  revalidatePath('/dashboard/system-management/cameras')
  revalidatePath('/dashboard/sales/demands/new')
  revalidatePath('/dashboard/finance/demands/new')
  revalidatePath('/dashboard/admin/demands')
}

export async function reorderDealerCamera(
  dealerId: string,
  cameraModelId: string,
  direction: 'up' | 'down'
): Promise<{
  success: boolean
  error?: string
  items?: { camera_model_id: string; sort_order: number }[]
}> {
  try {
    await verifyAuroraManager()
    const admin = createAdminClient()

    const { data: rows, error: fetchError } = await admin
      .from('dealer_cameras')
      .select('camera_model_id, sort_order, camera_models(name)')
      .eq('dealer_id', dealerId)

    if (fetchError) return { success: false, error: fetchError.message }
    if (!rows?.length) return { success: true, items: [] }

    type Row = (typeof rows)[number]
    const sorted = [...rows].sort((a: Row, b: Row) => {
      const ao = Number(a.sort_order ?? 0)
      const bo = Number(b.sort_order ?? 0)
      if (ao !== bo) return ao - bo
      const an = (a.camera_models as { name?: string } | null)?.name ?? ''
      const bn = (b.camera_models as { name?: string } | null)?.name ?? ''
      return an.localeCompare(bn)
    })

    const ids = sorted.map((r) => r.camera_model_id as string)
    const idx = ids.indexOf(cameraModelId)
    if (idx < 0) return { success: false, error: 'Camera not assigned to this dealer' }

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= ids.length) {
      return {
        success: true,
        items: ids.map((id, i) => ({ camera_model_id: id, sort_order: (i + 1) * 10 })),
      }
    }

    ;[ids[idx], ids[targetIdx]] = [ids[targetIdx]!, ids[idx]!]

    const newItems = ids.map((id, i) => ({ camera_model_id: id, sort_order: (i + 1) * 10 }))

    const updateResults = await Promise.all(
      newItems.map((item) =>
        admin
          .from('dealer_cameras')
          .update({ sort_order: item.sort_order })
          .eq('dealer_id', dealerId)
          .eq('camera_model_id', item.camera_model_id)
      )
    )

    const failed = updateResults.find((r) => r.error)
    if (failed?.error) {
      const msg = failed.error.message
      if (msg.includes('sort_order') && msg.includes('does not exist')) {
        return {
          success: false,
          error:
            'Database migration missing: run 20260912220000_dealer_camera_sort_order.sql on Supabase, then try again.',
        }
      }
      return { success: false, error: msg }
    }

    revalidateDealerCameraBookingPaths()
    return { success: true, items: newItems }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reorder camera',
    }
  }
}

export async function updateDealerCameraSortOrder(
  dealerId: string,
  cameraModelId: string,
  sortOrder: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
    const admin = createAdminClient()

    if (!Number.isFinite(sortOrder)) {
      return { success: false, error: 'Sort order must be a number' }
    }

    const { error } = await admin
      .from('dealer_cameras')
      .update({ sort_order: Math.round(sortOrder) })
      .eq('dealer_id', dealerId)
      .eq('camera_model_id', cameraModelId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidateDealerCameraBookingPaths()
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update camera sort order',
    }
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

