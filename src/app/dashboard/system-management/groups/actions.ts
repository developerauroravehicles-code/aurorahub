'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'

export async function getGroups() {
  const supabase = await createClient()
  const { data: groups, error } = await supabase
    .from('user_groups')
    .select('*')
    .order('name')

  if (error) return []
  const ids = (groups ?? []).map((g) => g.id)
  if (ids.length === 0) return groups ?? []

  const { data: counts } = await supabase
    .from('user_group_members')
    .select('group_id')
  const countByGroup = (counts ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.group_id] = (acc[row.group_id] ?? 0) + 1
    return acc
  }, {})

  return (groups ?? []).map((g) => ({ ...g, member_count: countByGroup[g.id] ?? 0 }))
}

export async function createGroup(formData: FormData) {
  const perm = await requirePermission('identity.groups.manage')
  if (perm !== true) return perm
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const name = formData.get('name') as string
  const description = (formData.get('description') as string) || null
  if (!name?.trim()) return { error: 'Group name is required' }
  const { error } = await supabase.from('user_groups').insert({
    name: name.trim(),
    description: description?.trim() || null,
    created_by: user?.id ?? null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/identity/groups')
  revalidatePath('/dashboard/system-management/groups')
  return { success: true }
}

export async function updateGroup(id: string, formData: FormData) {
  const perm = await requirePermission('identity.groups.manage')
  if (perm !== true) return perm
  const supabase = await createClient()
  const name = formData.get('name') as string
  const description = (formData.get('description') as string) || null
  if (!name?.trim()) return { error: 'Group name is required' }
  const { error } = await supabase.from('user_groups').update({ name: name.trim(), description: description?.trim() || null, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/identity/groups')
  revalidatePath('/dashboard/system-management/groups')
  return {}
}

export async function deleteGroup(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('user_groups').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/identity/groups')
  revalidatePath('/dashboard/system-management/groups')
  return {}
}

export async function getGroupMembers(groupId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_group_members')
    .select('user_id')
    .eq('group_id', groupId)
  if (error) return []
  const userIds = (data ?? []).map((r) => r.user_id)
  if (userIds.length === 0) return []

  // Use admin client for profiles - RLS may restrict read for regular users
  const perm = await requirePermission('identity.groups.manage')
  if (perm !== true) return []
  const supabaseAdmin = createAdminClient()
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id, full_name, role, dealer_id, dealers(code)').in('id', userIds)
  return (profiles ?? []).map((p) => ({
    user_id: p.id,
    profile: {
      ...p,
      dealer_code: (p as { dealers?: { code: string } | null })?.dealers?.code ?? null,
    },
  }))
}

export async function getProfilesForGroup(dealerId?: string | null) {
  const perm = await requirePermission('identity.groups.manage')
  if (perm !== true) return []

  // Use admin client to bypass RLS - profiles table may restrict read for regular users
  const supabaseAdmin = createAdminClient()
  let q = supabaseAdmin.from('profiles').select('id, full_name, role, dealer_id, dealers(code)').order('full_name')
  if (dealerId) q = q.eq('dealer_id', dealerId)
  const { data, error } = await q
  if (error) return []
  const rows = data ?? []
  return rows.map((r) => ({
    id: r.id,
    full_name: r.full_name ?? null,
    email: (r as { email?: string }).email ?? null,
    role: r.role ?? null,
    dealer_code: (r as { dealers?: { code: string } | null })?.dealers?.code ?? null,
  }))
}

export async function addMemberToGroup(groupId: string, userId: string) {
  const perm = await requirePermission('identity.groups.manage')
  if (perm !== true) return perm
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('user_group_members').insert({ group_id: groupId, user_id: userId, added_by: user?.id ?? null })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/identity/groups')
  revalidatePath('/dashboard/system-management/groups')
  return {}
}

export async function removeMemberFromGroup(groupId: string, userId: string) {
  const perm = await requirePermission('identity.groups.manage')
  if (perm !== true) return perm
  const supabase = await createClient()
  const { error } = await supabase.from('user_group_members').delete().eq('group_id', groupId).eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/identity/groups')
  revalidatePath('/dashboard/system-management/groups')
  return {}
}

export async function addMembersToGroup(groupId: string, userIds: string[]) {
  const perm = await requirePermission('identity.groups.manage')
  if (perm !== true) return perm
  if (!userIds.length) return { error: 'No users selected' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const rows = userIds.map((userId) => ({
    group_id: groupId,
    user_id: userId,
    added_by: user?.id ?? null,
  }))
  const { error } = await supabase.from('user_group_members').upsert(rows, {
    onConflict: 'group_id,user_id',
    ignoreDuplicates: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/identity/groups')
  revalidatePath('/dashboard/system-management/groups')
  return { success: true }
}
