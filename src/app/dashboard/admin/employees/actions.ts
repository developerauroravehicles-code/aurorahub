'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type UserRole = 'sales' | 'finance' | 'specialist' | 'aurora_manager' | 'general_manager' | 'hr' | 'it'

type ActionState = { error?: string; success?: boolean } | null

export async function createEmployee(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient()
    
    // Check current user's role
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return { error: 'Unauthorized' }
    }

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role, dealer_id')
      .eq('id', currentUser.id)
      .single()

    if (!currentProfile) {
      return { error: 'User profile not found' }
    }

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const role = formData.get('role') as string
    const fullName = formData.get('fullName') as string
    const phone = formData.get('phone') as string
    const dealerId = currentProfile.role === 'general_manager' && currentProfile.dealer_id
      ? currentProfile.dealer_id
      : (formData.get('dealerId') as string)

    if (!email || !password || !role) {
      return { error: 'Missing required fields' }
    }

    // Validate role
    const validRoles: UserRole[] = ['sales', 'finance', 'specialist', 'aurora_manager', 'general_manager', 'hr', 'it']
    if (!validRoles.includes(role as UserRole)) {
      return { error: 'Invalid role' }
    }

    // General Manager can only create sales and finance users
    if (currentProfile.role === 'general_manager') {
      if (role !== 'sales' && role !== 'finance') {
        return { error: 'General Managers can only create Sales and Finance employees' }
      }
    }

    // 1. Create Auth User
    const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })

    if (authError) {
      return { error: authError.message }
    }
    if (!user.user) {
      return { error: 'Failed to create user' }
    }

    // 2. Create Profile
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: user.user.id,
      role: role as UserRole,
      dealer_id: dealerId || null,
      full_name: fullName,
      phone: phone
    })

    if (profileError) {
        // Rollback user creation
        await supabaseAdmin.auth.admin.deleteUser(user.user.id)
        return { error: 'Failed to create profile: ' + profileError.message }
    }

    revalidatePath('/dashboard/admin/employees')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create employee' }
  }
}

export async function resetEmployeePassword(userId: string, newPassword: string) {
  const supabaseAdmin = createAdminClient()

  if (!newPassword || newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters long' }
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  )

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/admin/employees')
  revalidatePath('/dashboard/identity/users')
  return { success: true }
}
