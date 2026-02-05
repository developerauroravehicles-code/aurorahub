'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

type UserRole = 'sales' | 'finance' | 'specialist' | 'aurora_manager' | 'general_manager'

type ActionState = { error?: string; success?: boolean } | null

export async function createEmployee(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const supabaseAdmin = createAdminClient()
    
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const role = formData.get('role') as string
    const fullName = formData.get('fullName') as string
    const dealerId = formData.get('dealerId') as string
    const phone = formData.get('phone') as string

    if (!email || !password || !role) {
      return { error: 'Missing required fields' }
    }

    // Validate role
    const validRoles: UserRole[] = ['sales', 'finance', 'specialist', 'aurora_manager', 'general_manager']
    if (!validRoles.includes(role as UserRole)) {
      return { error: 'Invalid role' }
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
    // dealerId might be empty string -> null
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
  return { success: true }
}
