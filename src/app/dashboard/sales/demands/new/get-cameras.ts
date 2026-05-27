'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Active catalog models for demand forms. Inventory consumption on completed demands
 * uses the camera catalog (name / camera_model_id), not dealer_cameras — so listing
 * must match what can be installed, i.e. all active models (same as admin demand flow).
 */
export async function getCameraModels() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
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

  if (!profile || !profile.dealer_id) {
    console.log('getCameraModels: No dealer_id for user:', user.id)
    return []
  }

  const { data: cameras, error: camerasError } = await supabase
    .from('camera_models')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (camerasError) {
    console.error('getCameraModels: Error fetching camera models:', camerasError)
    return []
  }

  return cameras ?? []
}

