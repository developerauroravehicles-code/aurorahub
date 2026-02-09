'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { SystemData } from '@/types/system-management'

// Helper to get a fresh admin client every time with explicit schema
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public',
    }
  })
}

export async function getSystemData(): Promise<SystemData> {
  // Verify user is Aurora Manager
  const { createClient } = await import('@/lib/supabase/server')
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

  if (profile?.role !== 'aurora_manager') {
    throw new Error('Unauthorized: Only Aurora Manager can access System Management')
  }

  const supabaseAdmin = getAdminClient()
  
  // Fetch dealers
  const { data: dealers, error: dealersError } = await supabaseAdmin
    .from('dealers')
    .select('id, name, code, address, region_code_id, created_at')
    .order('created_at', { ascending: false })

  // Fetch profiles with dealer info
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('*, dealers(name, code)')
    .order('created_at', { ascending: false })

  // Fetch camera models with dealer assignments
  const { data: cameras, error: camerasError } = await supabaseAdmin
    .from('camera_models')
    .select(`
      *,
      dealer_cameras(
        dealer_id,
        dealers(id, name, code)
      )
    `)
    .order('name', { ascending: true })
  
  // Log errors if they occur
  if (dealersError) {
    console.error('Error fetching dealers:', dealersError)
  }
  if (profilesError) {
    console.error('Error fetching profiles:', profilesError)
  }
  if (camerasError) {
    console.error('Error fetching cameras:', camerasError)
  }

  return {
    dealers: dealers || [],
    profiles: profiles || [],
    cameras: cameras || [],
    projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    errors: {
      dealers: dealersError?.message,
      profiles: profilesError?.message,
      cameras: camerasError?.message
    }
  }
}

async function verifyAuroraManager() {
  const { createClient } = await import('@/lib/supabase/server')
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

  if (profile?.role !== 'aurora_manager') {
    throw new Error('Unauthorized: Only Aurora Manager can access System Management')
  }
}

type ActionState = { error?: string; success?: string } | null

export async function createDealer(prevState: ActionState, formData: FormData) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  if (!formData) return { error: 'Invalid form data received.' }
  
  const name = formData.get('name') as string
  const code = formData.get('code') as string
  const address = formData.get('address') as string

  if (!name || !code) return { error: 'Name and Code are required' }

  const { error } = await supabaseAdmin.from('dealers').insert({
    name,
    code,
    address
  })

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/system-management/dealer')
  return { success: `Dealer created successfully` }
}

export async function createUser(prevState: ActionState, formData: FormData) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  if (!formData) return { error: 'Invalid form data received.' }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const role = formData.get('role') as string
  const dealerCode = formData.get('dealerCode') as string
  const phone = formData.get('phone') as string

  if (!email || !password || !role) return { error: 'Missing required fields' }

  // 1. Create Auth User
  const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  })

  if (authError) {
    const msg = authError.message || ''
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered') || msg.toLowerCase().includes('duplicate') || msg.includes('users_email_key')) {
      return { error: 'Bu e-posta adresi daha önce kullanılmış. Silinen kullanıcıların e-postası Supabase tarafında bir süre rezerve kalabilir. Farklı bir e-posta deneyin veya Supabase Dashboard > Authentication > Users üzerinden ilgili kullanıcıyı kalıcı silin.' }
    }
    return { error: authError.message }
  }
  if (!userData.user) return { error: 'Failed to create user' }

  // 2. Find Dealer ID
  let dealerId = null
  if (dealerCode) {
      const { data: dealer } = await supabaseAdmin
        .from('dealers')
        .select('id')
        .eq('code', dealerCode)
        .single()
      
      if (dealer) dealerId = dealer.id
      else {
          await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
          return { error: 'Dealer code not found. User created but rolled back.' }
      }
  }

  // 3. Create Profile
  type UserRole = 'sales' | 'finance' | 'specialist' | 'aurora_manager' | 'general_manager'
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: userData.user.id,
    role: role as UserRole,
    dealer_id: dealerId,
    full_name: fullName,
    phone: phone
  })

  if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
      return { error: 'User created but profile failed: ' + profileError.message }
  }

  revalidatePath('/dashboard/system-management/user')
  return { success: 'User created successfully!' }
}

export async function getProfileForEdit(userId: string) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, phone, role, dealer_id, dealers(id, name, code)')
    .eq('id', userId)
    .single()

  if (profileError || !profile) return { error: 'Profile not found', profile: null }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
  const email = authError ? undefined : authUser?.user?.email

  return {
    profile: {
      ...profile,
      email
    },
    error: null
  }
}

type UserRole = 'sales' | 'finance' | 'specialist' | 'aurora_manager' | 'general_manager'

export async function updateUser(prevState: ActionState, formData: FormData) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  if (!formData) return { error: 'Invalid form data received.' }

  const userId = formData.get('userId') as string
  const fullName = formData.get('fullName') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const role = formData.get('role') as string
  const dealerCode = formData.get('dealerCode') as string

  if (!userId || !fullName || !role) return { error: 'User ID, full name and role are required.' }

  let dealerId: string | null = null
  if (dealerCode?.trim()) {
    const { data: dealer } = await supabaseAdmin
      .from('dealers')
      .select('id')
      .eq('code', dealerCode.trim())
      .single()
    if (dealer) dealerId = dealer.id
    else return { error: 'Dealer code not found.' }
  }

  if (email?.trim()) {
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(userId)
    const currentEmail = existingUser?.user?.email?.toLowerCase()
    const newEmail = email.trim().toLowerCase()
    if (currentEmail !== newEmail) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: email.trim()
      })
      if (authError) return { error: 'Failed to update email: ' + authError.message }
    }
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: fullName.trim(),
      phone: phone?.trim() || null,
      role: role as UserRole,
      dealer_id: dealerId
    })
    .eq('id', userId)

  if (profileError) return { error: 'Failed to update profile: ' + profileError.message }

  revalidatePath('/dashboard/system-management/user')
  return { success: 'User updated successfully!' }
}

export async function deleteUser(userId: string) {
  await verifyAuroraManager()
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  if (user.id === userId) return { error: 'You cannot delete your own account.' }

  const supabaseAdmin = getAdminClient()
  // Önce public.profiles kaydını sil (auth silinince sarkan kayıt kalmasın)
  await supabaseAdmin.from('profiles').delete().eq('id', userId)
  // Hard delete (shouldSoftDelete: false) — e-posta yeni kullanıcıda kullanılabilsin
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId, false)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/system-management/user')
  return { success: 'User deleted successfully.' }
}

export async function createCameraModel(prevState: ActionState, formData: FormData) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  if (!formData) return { error: 'Invalid form data received.' }

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const stockQuantity = formData.get('stockQuantity') as string

  if (!name) return { error: 'Camera model name is required' }

  const { error } = await supabaseAdmin.from('camera_models').insert({
    name: name.trim(),
    description: description?.trim() || null,
    stock_quantity: stockQuantity ? parseInt(stockQuantity) : 0,
    is_active: true
  })

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/system-management/cameras')
  return { success: 'Camera model created successfully!' }
}

export async function updateCameraModel(prevState: ActionState, formData: FormData) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  if (!formData) return { error: 'Invalid form data received.' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const stockQuantity = formData.get('stockQuantity') as string

  if (!id || !name) return { error: 'ID and name are required' }

  const { error } = await supabaseAdmin
    .from('camera_models')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      stock_quantity: stockQuantity ? parseInt(stockQuantity) : 0
    })
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/system-management/cameras')
  return { success: 'Camera model updated successfully!' }
}

export async function updateCameraStock(cameraId: string, stockQuantity: number) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  const { error } = await supabaseAdmin
    .from('camera_models')
    .update({ stock_quantity: stockQuantity })
    .eq('id', cameraId)

  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/dashboard/system-management/cameras')
  return { success: 'Stock updated successfully!' }
}

export async function assignCameraToDealer(cameraId: string, dealerId: string) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  const { error } = await supabaseAdmin
    .from('dealer_cameras')
    .insert({ camera_model_id: cameraId, dealer_id: dealerId })

  if (error) {
    // If already exists, ignore
    if (error.code === '23505') {
      return { success: 'Camera already assigned to this dealer' }
    }
    return { error: error.message }
  }
  
  revalidatePath('/dashboard/system-management/cameras')
  return { success: 'Camera assigned to dealer successfully!' }
}

export async function removeCameraFromDealer(cameraId: string, dealerId: string) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  const { error } = await supabaseAdmin
    .from('dealer_cameras')
    .delete()
    .eq('camera_model_id', cameraId)
    .eq('dealer_id', dealerId)

  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/dashboard/system-management/cameras')
  return { success: 'Camera removed from dealer successfully!' }
}

export async function deleteCameraModel(id: string) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  const { error } = await supabaseAdmin
    .from('camera_models')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/dashboard/system-management/cameras')
  return { success: 'Camera model deleted successfully!' }
}

export async function toggleCameraModelStatus(id: string, isActive: boolean) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  const { error } = await supabaseAdmin
    .from('camera_models')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/dashboard/system-management/cameras')
  return { success: `Camera model ${isActive ? 'activated' : 'deactivated'} successfully!` }
}

