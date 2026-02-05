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

type ActionState = { error?: string } | null

export async function login(prevState: ActionState, formData: FormData) {
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

  if (!profile) {
    await supabase.auth.signOut()
    return { error: 'Profile not found.' }
  }

  // Normalize dealer code (trim and uppercase for comparison)
  const normalizedDealerCode = dealerCode.trim().toUpperCase()
  
  // Type-safe dealer code check
  // Supabase returns dealers as an array from the join
  type DealerInfo = { code: string }
  const dealersArray = profile.dealers as DealerInfo[] | null | undefined
  
  // If user has a dealer_id, check dealer code
  if (profile.dealer_id) {
    const dealer = Array.isArray(dealersArray) && dealersArray.length > 0 ? dealersArray[0] : null
    
    if (!dealer) {
      await supabase.auth.signOut()
      return { error: 'Dealer information not found. Please contact support.' }
    }
    
    // Case-insensitive comparison
    const dealerMatch = dealer.code.trim().toUpperCase() === normalizedDealerCode
    
    if (!dealerMatch) {
      await supabase.auth.signOut()
      return { error: 'Dealer code does not match your account.' }
    }
  } else {
    // For users without dealer_id (HQ staff), accept "HQ" as dealer code
    if (normalizedDealerCode !== 'HQ') {
      await supabase.auth.signOut()
      return { error: 'Dealer code does not match your account.' }
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

