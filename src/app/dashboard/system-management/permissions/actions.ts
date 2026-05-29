'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const ROLES = ['aurora_manager', 'it', 'hr', 'sales', 'finance', 'specialist', 'general_manager', 'inventory_manager'] as const

async function ensureCanManagePermissions() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', supabase: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['aurora_manager', 'it'].includes(profile?.role ?? '')) {
    return { error: 'Unauthorized', supabase: null }
  }
  return { supabase, userId: user.id }
}

export async function getPermissionsWithRoles() {
  const { supabase } = await ensureCanManagePermissions()
  if (!supabase) return { permissions: [], rolePermissions: {} }

  const [permsRes, rpRes] = await Promise.all([
    supabase.from('permissions').select('code, name, description, category').order('category').order('code'),
    supabase.from('role_permissions').select('role, permission_code'),
  ])

  const permissions = permsRes.data ?? []
  const rolePermissions: Record<string, Set<string>> = {}
  for (const r of ROLES) {
    rolePermissions[r] = new Set()
  }
  for (const rp of rpRes.data ?? []) {
    if (ROLES.includes(rp.role as typeof ROLES[number])) {
      rolePermissions[rp.role].add(rp.permission_code)
    }
  }

  return { permissions, rolePermissions }
}

export async function setRolePermission(
  role: string,
  permissionCode: string,
  granted: boolean
) {
  const { supabase } = await ensureCanManagePermissions()
  if (!supabase) return { error: 'Unauthorized' }

  if (granted) {
    const { error } = await supabase
      .from('role_permissions')
      .upsert({ role, permission_code: permissionCode }, { onConflict: 'role,permission_code' })
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role', role)
      .eq('permission_code', permissionCode)
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/identity/permissions')
  return { success: true }
}

export async function grantRoleAllCategory(role: string, category: string) {
  const { supabase } = await ensureCanManagePermissions()
  if (!supabase) return { error: 'Unauthorized' }

  const { data: perms } = await supabase
    .from('permissions')
    .select('code')
    .eq('category', category)
  if (!perms?.length) return { success: true }

  const rows = perms.map((p) => ({ role, permission_code: p.code }))
  const { error } = await supabase.from('role_permissions').upsert(rows, { onConflict: 'role,permission_code' })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/identity/permissions')
  return { success: true }
}

export async function revokeRoleAllCategory(role: string, category: string) {
  const { supabase } = await ensureCanManagePermissions()
  if (!supabase) return { error: 'Unauthorized' }

  const { data: perms } = await supabase
    .from('permissions')
    .select('code')
    .eq('category', category)
  if (!perms?.length) return { success: true }

  const codes = perms.map((p) => p.code)
  const { error } = await supabase
    .from('role_permissions')
    .delete()
    .eq('role', role)
    .in('permission_code', codes)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/identity/permissions')
  return { success: true }
}
