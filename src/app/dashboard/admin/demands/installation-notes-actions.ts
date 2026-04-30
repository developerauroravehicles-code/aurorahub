'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const bodySchema = z.string().trim().min(1, 'Comment cannot be empty').max(4000, 'Comment is too long (max 4000 characters)')

export async function addDemandInstallationNote(
  demandId: string,
  body: string
): Promise<{ ok?: boolean; error?: string }> {
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(', ') || 'Invalid comment' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Managers can add installation notes.' }
  }

  const { error } = await supabase.from('demand_installation_notes').insert({
    demand_id: demandId,
    author_id: user.id,
    body: parsed.data,
  })

  if (error) {
    console.error('addDemandInstallationNote:', error)
    return { error: error.message ?? 'Could not save comment.' }
  }

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  return { ok: true }
}

export async function deleteDemandInstallationNote(
  noteId: string,
  demandId: string
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Managers can remove installation notes.' }
  }

  const { error } = await supabase.from('demand_installation_notes').delete().eq('id', noteId).eq('demand_id', demandId)

  if (error) {
    console.error('deleteDemandInstallationNote:', error)
    return { error: error.message ?? 'Could not delete comment.' }
  }

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  return { ok: true }
}
