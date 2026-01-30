'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function completeDemand(demandId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('demands')
    .update({ status: 'completed' })
    .eq('id', demandId)
  
  if (error) return { error: error.message }
  revalidatePath('/dashboard/specialist/work')
}

