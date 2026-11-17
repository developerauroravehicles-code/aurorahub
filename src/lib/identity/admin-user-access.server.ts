import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getNextPasswordPromptAtAfterChange } from '@/lib/password-change/prompt'
import { isUserCredentialManager, normalizeAdminPassword } from '@/lib/identity/user-credential-manager'

export async function assertUserCredentialManager(): Promise<
  { error: string; userId: null } | { error: null; userId: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', userId: null }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!isUserCredentialManager(profile?.role)) {
    return { error: 'Only Aurora Manager, HR, or IT can manage user passwords and login access.', userId: null }
  }

  return { error: null, userId: user.id }
}

/** Re-apply password via admin API and mark profile ready to sign in (matches IT reset flow). */
export async function applyAdminUserPassword(
  supabaseAdmin: SupabaseClient,
  userId: string,
  password: string
): Promise<{ error?: string }> {
  const normalized = normalizeAdminPassword(password)
  if ('error' in normalized) return { error: normalized.error }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: normalized.password,
    email_confirm: true,
    ban_duration: 'none',
  })
  if (error) return { error: error.message }

  const now = new Date().toISOString()
  const nextPromptAt = await getNextPasswordPromptAtAfterChange()

  await supabaseAdmin
    .from('profiles')
    .update({
      password_last_changed_at: now,
      next_password_prompt_at: nextPromptAt,
    })
    .eq('id', userId)

  return {}
}