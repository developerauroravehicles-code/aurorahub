'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createEmployee(formData: FormData): Promise<void> {
  const supabaseAdmin = createAdminClient()
  
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as string
  const fullName = formData.get('fullName') as string
  const dealerId = formData.get('dealerId') as string
  const phone = formData.get('phone') as string

  if (!email || !password || !role) {
    throw new Error('Missing required fields')
  }

  // 1. Create Auth User
  const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  })

  if (authError) {
    throw new Error(authError.message)
  }
  if (!user.user) {
    throw new Error('Failed to create user')
  }

  // 2. Create Profile
  // dealerId might be empty string -> null
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: user.user.id,
    role: role as any,
    dealer_id: dealerId || null,
    full_name: fullName,
    phone: phone
  })

  if (profileError) {
      // Rollback user creation
      await supabaseAdmin.auth.admin.deleteUser(user.user.id)
      throw new Error('Failed to create profile: ' + profileError.message)
  }

  revalidatePath('/dashboard/admin/employees')
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
