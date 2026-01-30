'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createDealer(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const name = formData.get('name') as string
  const code = formData.get('code') as string
  const address = formData.get('address') as string

  if (!name || !code) {
    throw new Error('Missing fields')
  }

  const { error } = await supabase.from('dealers').insert({ name, code, address })
  if (error) {
    throw new Error(error.message)
  }
  
  revalidatePath('/dashboard/admin/dealers')
}

