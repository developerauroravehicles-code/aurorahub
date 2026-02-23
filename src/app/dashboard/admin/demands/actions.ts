'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function deleteDemand(demandId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Managers can delete appointments' }
  }

  const { error } = await supabase
    .from('demands')
    .delete()
    .eq('id', demandId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/demands')
  revalidatePath('/dashboard')
  redirect('/dashboard/admin/demands')
}
