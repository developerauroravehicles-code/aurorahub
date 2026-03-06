'use server'

import { createClient } from '@/lib/supabase/server'

// If migration not run: it and aurora_manager have all system permissions by default
const LEGACY_SYSTEM_ROLES = ['aurora_manager', 'it']

/** Checks whether the user has the specified permission. */
export async function checkPermission(
  userId: string,
  permissionCode: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (!profile?.role) return false

  // aurora_manager her zaman tüm yetkilere sahip (super admin)
  if (profile.role === 'aurora_manager') return true

  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission_code')
      .eq('role', profile.role)
      .eq('permission_code', permissionCode)
      .maybeSingle()

    if (error) {
      // If table does not exist (migration not run), use legacy role check
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return LEGACY_SYSTEM_ROLES.includes(profile.role)
      }
      return false
    }
    return !!data
  } catch {
    return LEGACY_SYSTEM_ROLES.includes(profile.role)
  }
}

/** Checks the current user's permission. */
export async function checkCurrentUserPermission(
  permissionCode: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  return checkPermission(user.id, permissionCode)
}

/** Returns all permissions for the given role. */
export async function getRolePermissions(role: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('role_permissions')
    .select('permission_code')
    .eq('role', role)
  return (data ?? []).map((r) => r.permission_code)
}

/**
 * Returns error if current user lacks permission.
 * Usage in actions: const ok = await requirePermission('comm.sms.view'); if (ok !== true) return ok
 */
export async function requirePermission(permissionCode: string): Promise<true | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const has = await checkPermission(user.id, permissionCode)
  if (!has) return { error: 'You do not have permission for this operation.' }
  return true
}
