'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveCamerasForDealer } from '@/lib/dealer-camera-catalog'

/**
 * Dealer-assigned active camera models for demand forms, in configured display order.
 */
export async function getCameraModels() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.log('getCameraModels: No user found')
    return []
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('dealer_id')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('getCameraModels: Profile error:', profileError)
    return []
  }

  if (!profile?.dealer_id) {
    console.log('getCameraModels: No dealer_id for user:', user.id)
    return []
  }

  return getActiveCamerasForDealer(supabase, profile.dealer_id)
}
