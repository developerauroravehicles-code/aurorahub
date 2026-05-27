'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { SystemData, Profile } from '@/types/system-management'
import { normalizeEmail } from '@/lib/email-normalize'

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

  if (!['aurora_manager', 'hr', 'it'].includes(profile?.role ?? '')) {
    throw new Error('Unauthorized: Only platform admin can access System Management')
  }

  const supabaseAdmin = getAdminClient()
  
  // Fetch dealers
  const { data: dealers, error: dealersError } = await supabaseAdmin
    .from('dealers')
    .select('id, name, code, address, phone, region_code_id, created_at')
    .order('created_at', { ascending: false })

  // Fetch profiles with dealer info
  const { data: rawProfiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('*, dealers(name, code)')
    .order('created_at', { ascending: false })

  // Fetch platform personnel WITHOUT profile (created by HR, no login yet)
  const { data: personnelOnly } = await supabaseAdmin
    .from('personnel')
    .select('id, full_name, phone, email, platform_role, created_at')
    .is('dealer_id', null)
    .is('profile_id', null)
    .order('created_at', { ascending: false })

  const merged: Array<Record<string, unknown>> = [...(rawProfiles || [])]
  ;(personnelOnly || []).forEach((p) => {
    merged.push({
      id: `personnel-${p.id}`,
      full_name: p.full_name,
      phone: p.phone,
      email: p.email,
      role: p.platform_role || '—',
      dealers: null,
      dealers_name: null,
      dealers_code: null,
      created_at: p.created_at,
      _source: 'personnel',
      _personnelId: p.id,
      _personnelEmail: p.email,
    })
  })

  // IT role at end; others newest first (aligned with HR Employees)
  const profiles = merged.sort((a, b) => {
    const aRole = String(a.role ?? '')
    const bRole = String(b.role ?? '')
    const aIsIt = aRole === 'it' ? 1 : 0
    const bIsIt = bRole === 'it' ? 1 : 0
    if (aIsIt !== bIsIt) return aIsIt - bIsIt
    const aCreated = String(a.created_at ?? '')
    const bCreated = String(b.created_at ?? '')
    return bCreated.localeCompare(aCreated)
  })

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
    profiles: profiles as unknown as Profile[],
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

  if (!['aurora_manager', 'hr', 'it'].includes(profile?.role ?? '')) {
    throw new Error('Unauthorized: Only platform admin can access System Management')
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
  const phone = formData.get('phone') as string

  if (!name || !code) return { error: 'Name and Code are required' }

  const { error } = await supabaseAdmin.from('dealers').insert({
    name,
    code,
    address: address || null,
    phone: phone?.trim() || null
  })

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/configuration/dealers')
  return { success: `Dealer created successfully` }
}

export async function createUser(prevState: ActionState, formData: FormData) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  if (!formData) return { error: 'Invalid form data received.' }

  const email = normalizeEmail(formData.get('email') as string)
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
      return { error: 'This email address has already been used. Deleted users\' emails may remain reserved in Supabase for a while. Try a different email or permanently delete the user via Supabase Dashboard > Authentication > Users.' }
    }
    return { error: authError.message }
  }
  if (!userData.user) return { error: 'Failed to create user' }

  // 2. Find Dealer ID (or Platform: HQ = dealer_id null)
  let dealerId: string | null = null
  const normalizedCode = dealerCode?.trim().toUpperCase()

  if (dealerCode && normalizedCode === 'HQ') {
    dealerId = null
  } else if (dealerCode) {
    const { data: dealer } = await supabaseAdmin
      .from('dealers')
      .select('id')
      .ilike('code', dealerCode.trim())
      .single()
    if (dealer) dealerId = dealer.id
    else {
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
      return { error: 'Dealer code not found. User created but rolled back.' }
    }
  }

  // 3. Create Profile
  type UserRole = 'sales' | 'finance' | 'specialist' | 'aurora_manager' | 'general_manager' | 'hr' | 'it'
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: userData.user.id,
    role: role as UserRole,
    dealer_id: dealerId,
    full_name: fullName,
    phone: phone || null
  })

  if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
      return { error: 'User created but profile failed: ' + profileError.message }
  }

  // Sync: Create personnel for platform users (dealer_id null)
  if (dealerId === null) {
    const { data: existing } = await supabaseAdmin
      .from('personnel')
      .select('id')
      .eq('profile_id', userData.user.id)
      .single()
    if (!existing) {
      const workerId = `WRK-${Date.now().toString(36).toUpperCase()}`
      const platformRole = ['specialist', 'aurora_manager', 'hr', 'it'].includes(role) ? role : null
      const { error: personnelError } = await supabaseAdmin.from('personnel').insert({
        profile_id: userData.user.id,
        dealer_id: null,
        worker_id: workerId,
        worker_type: 'employee',
        status: 'active',
        full_name: fullName,
        phone: phone || null,
        email: email,
        platform_role: platformRole,
      })
      if (personnelError) {
        console.error('Personnel sync failed (user created):', personnelError)
      }
    }
  }

  revalidatePath('/dashboard/identity/users')
  revalidatePath('/dashboard/hr/employees')
  revalidatePath('/dashboard/hr/personnel')
  return { success: 'User created successfully!' }
}

export async function createLoginForPersonnel(personnelId: string, email: string, password: string) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !password || password.length < 6) {
    return { error: 'Email and password (min 6 characters) are required.' }
  }

  const { data: personnel, error: personnelError } = await supabaseAdmin
    .from('personnel')
    .select('id, full_name, phone, platform_role, email')
    .eq('id', personnelId)
    .is('profile_id', null)
    .single()

  if (personnelError || !personnel) {
    return { error: 'Personnel not found or already has login.' }
  }

  const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: personnel.full_name }
  })

  if (authError) {
    const msg = authError.message || ''
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered') || msg.toLowerCase().includes('duplicate') || msg.includes('users_email_key')) {
      return { error: 'This email is already in use. Try a different email.' }
    }
    return { error: authError.message }
  }
  if (!userData.user) return { error: 'Failed to create user' }

  const role = ['specialist', 'aurora_manager', 'hr', 'it'].includes(String(personnel.platform_role || ''))
    ? personnel.platform_role
    : 'it'

  type UserRole = 'sales' | 'finance' | 'specialist' | 'aurora_manager' | 'general_manager' | 'hr' | 'it'
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: userData.user.id,
    role: role as UserRole,
    dealer_id: null,
    full_name: personnel.full_name,
    phone: personnel.phone || null
  })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
    return { error: 'Failed to create profile: ' + profileError.message }
  }

  const { error: updateError } = await supabaseAdmin
    .from('personnel')
    .update({ profile_id: userData.user.id, email: normalizedEmail, updated_at: new Date().toISOString() })
    .eq('id', personnelId)

  if (updateError) {
    await supabaseAdmin.from('profiles').delete().eq('id', userData.user.id)
    await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
    return { error: 'Failed to link personnel: ' + updateError.message }
  }

  revalidatePath('/dashboard/identity/users')
  revalidatePath('/dashboard/hr/employees')
  revalidatePath('/dashboard/hr/personnel')
  return { success: true }
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

export async function updateUser(prevState: ActionState, formData: FormData) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  if (!formData) return { error: 'Invalid form data received.' }

  const userId = formData.get('userId') as string
  const fullName = formData.get('fullName') as string
  const phone = formData.get('phone') as string
  const emailRaw = formData.get('email') as string
  const role = formData.get('role') as string
  const dealerCode = formData.get('dealerCode') as string

  if (!userId || !fullName || !role) return { error: 'User ID, full name and role are required.' }

  let dealerId: string | null = null
  const normalizedCode = dealerCode?.trim().toUpperCase()
  if (normalizedCode === 'HQ') {
    dealerId = null
  } else if (dealerCode?.trim()) {
    const { data: dealer } = await supabaseAdmin
      .from('dealers')
      .select('id')
      .ilike('code', dealerCode.trim())
      .single()
    if (dealer) dealerId = dealer.id
    else return { error: 'Dealer code not found.' }
  }

  const email = normalizeEmail(emailRaw)
  if (email) {
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(userId)
    const currentEmail = existingUser?.user?.email?.toLowerCase()
    if (currentEmail !== email) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email,
      })
      if (authError) return { error: 'Failed to update email: ' + authError.message }
    }
  }

  type UserRole = 'sales' | 'finance' | 'specialist' | 'aurora_manager' | 'general_manager' | 'hr' | 'it'
  const updateData = {
    full_name: fullName.trim(),
    phone: phone?.trim() || null,
    role: role as UserRole,
    dealer_id: dealerId
  }
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update(updateData)
    .eq('id', userId)

  if (profileError) return { error: 'Failed to update profile: ' + profileError.message }

  // Sync: Update personnel (platform or dealer)
  const platformRole = dealerId === null && ['specialist', 'aurora_manager', 'hr', 'it'].includes(role) ? role : null
  const { error: personnelError } = await supabaseAdmin
    .from('personnel')
    .update({
      full_name: fullName.trim(),
      phone: phone?.trim() || null,
      platform_role: platformRole,
      dealer_id: dealerId,
      updated_at: new Date().toISOString(),
    })
    .eq('profile_id', userId)
  if (personnelError) {
    console.error('Personnel sync failed (user updated):', personnelError)
  }

  revalidatePath('/dashboard/identity/users')
  revalidatePath('/dashboard/hr/employees')
  revalidatePath('/dashboard/hr/personnel')
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

  // Null out foreign keys that reference this profile so the profile can be deleted
  const { error: demandsError } = await supabaseAdmin
    .from('demands')
    .update({
      created_by: null,
      assigned_specialist_id: null,
      assigned_finance_id: null
    })
    .or(`created_by.eq.${userId},assigned_specialist_id.eq.${userId},assigned_finance_id.eq.${userId}`)
  if (demandsError) return { error: 'Database error updating demands: ' + demandsError.message }

  const { error: logsError } = await supabaseAdmin
    .from('demand_logs')
    .update({ actor_id: null })
    .eq('actor_id', userId)
  if (logsError) return { error: 'Database error updating logs: ' + logsError.message }

  const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', userId)
  if (profileError) return { error: 'Database error deleting user: ' + profileError.message }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId, false)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/identity/users')
  revalidatePath('/dashboard/hr/employees')
  revalidatePath('/dashboard/hr/personnel')
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
  
  revalidatePath('/dashboard/configuration/cameras')
  revalidatePath('/dashboard/admin/inventory')
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
  
  revalidatePath('/dashboard/configuration/cameras')
  revalidatePath('/dashboard/admin/inventory')
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
  
  revalidatePath('/dashboard/configuration/cameras')
  revalidatePath('/dashboard/admin/inventory')
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

  const { notifyCameraDealerAssignment } = await import('@/lib/camera-dealer-notify')
  notifyCameraDealerAssignment('assigned', dealerId, cameraId).catch(() => {})

  revalidatePath('/dashboard/configuration/cameras')
  revalidatePath('/dashboard/system-management/dealer')
  return { success: 'Camera assigned to dealer successfully!' }
}

/** Bulk link one catalog model to every dealer (for reporting/UI parity). Demand forms already use full active catalog. */
export async function assignCameraToAllDealers(cameraId: string) {
  await verifyAuroraManager()
  const supabaseAdmin = getAdminClient()

  const { data: dealers, error: dealersError } = await supabaseAdmin.from('dealers').select('id')
  if (dealersError || !dealers?.length) {
    return { error: dealersError?.message ?? 'No dealers found' }
  }

  const { data: existing, error: exError } = await supabaseAdmin
    .from('dealer_cameras')
    .select('dealer_id')
    .eq('camera_model_id', cameraId)

  if (exError) return { error: exError.message }

  const assigned = new Set((existing ?? []).map((r) => r.dealer_id))
  const rows = dealers.filter((d) => !assigned.has(d.id)).map((d) => ({
    dealer_id: d.id,
    camera_model_id: cameraId,
  }))

  if (rows.length === 0) {
    return { success: 'This camera is already assigned to all dealers.', assigned: 0 }
  }

  const { error: insError } = await supabaseAdmin.from('dealer_cameras').insert(rows)
  if (insError) return { error: insError.message }

  revalidatePath('/dashboard/configuration/cameras')
  revalidatePath('/dashboard/system-management/dealer')
  return { success: `Assigned to ${rows.length} dealer(s).`, assigned: rows.length }
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

  const { notifyCameraDealerAssignment } = await import('@/lib/camera-dealer-notify')
  notifyCameraDealerAssignment('removed', dealerId, cameraId).catch(() => {})

  revalidatePath('/dashboard/configuration/cameras')
  revalidatePath('/dashboard/system-management/dealer')
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
  
  revalidatePath('/dashboard/configuration/cameras')
  revalidatePath('/dashboard/admin/inventory')
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
  
  revalidatePath('/dashboard/configuration/cameras')
  revalidatePath('/dashboard/admin/inventory')
  return { success: `Camera model ${isActive ? 'activated' : 'deactivated'} successfully!` }
}

