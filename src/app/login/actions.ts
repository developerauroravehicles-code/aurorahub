'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logIdentityEvent } from '@/lib/identity-audit'
import { assertUserCanSignIn, formatLoginAuthError } from '@/lib/user-login-access'
import { z } from 'zod'
import { normalizeEmail } from '@/lib/email-normalize'

const loginSchema = z.object({
  dealerCode: z.string().min(1, 'Dealer code is required'),
  email: z.preprocess((v) => normalizeEmail(String(v ?? '')), z.string().email()),
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
    return { error: formatLoginAuthError(error.message) }
  }

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
      return { error: 'Authentication failed' }
  }

  // Verify Dealer Code
  const { data: profile } = await supabase
    .from('profiles')
    .select('dealer_id')
    .eq('id', user.user.id)
    .single()

  if (!profile) {
    await supabase.auth.signOut()
    return { error: 'Profile not found.' }
  }

  // Normalize dealer code (trim and uppercase for comparison)
  const normalizedDealerCode = dealerCode.trim().toUpperCase()
  
  // If user has a dealer_id, fetch dealer and check dealer code
  if (profile.dealer_id) {
    const { data: dealer } = await supabase
      .from('dealers')
      .select('code')
      .eq('id', profile.dealer_id)
      .single()
    
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

  const accessCheck = await assertUserCanSignIn(user.user.id, { skipCache: true })
  if (accessCheck.error) {
    await supabase.auth.signOut()
    await logIdentityEvent({
      eventType: 'login_failed',
      userId: user.user.id,
      email: user.user.email ?? undefined,
      metadata: { reason: accessCheck.error },
    })
    return { error: accessCheck.error }
  }

  const h = await headers()
  await logIdentityEvent({
    eventType: 'login_success',
    userId: user.user.id,
    email: user.user.email ?? undefined,
    ipAddress: h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? null,
    userAgent: h.get('user-agent') ?? null,
  })

  redirect('/dashboard')
}

