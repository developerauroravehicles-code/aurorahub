'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const loginSchema = z.object({
  dealerCode: z.string().min(1, 'Dealer code is required'),
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
})

export async function login(prevState: any, formData: FormData) {
  const data = Object.fromEntries(formData)
  const result = loginSchema.safeParse(data)

  if (!result.success) {
    return { error: 'Invalid input. Please check your details.' }
  }

  const { dealerCode, email, password } = result.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
      return { error: 'Authentication failed' }
  }

  // Verify Dealer Code
  const { data: profile } = await supabase
    .from('profiles')
    .select('dealer_id, dealers(code)')
    .eq('id', user.user.id)
    .single()

  // Types might be unknown here, treating as any/inferred
  const dealerMatch = profile?.dealers && (profile.dealers as any).code === dealerCode

  if (!profile || !dealerMatch) {
    await supabase.auth.signOut()
    return { error: 'Dealer code does not match your account.' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

