'use server'

import { createClient } from '@/lib/supabase/server'

export async function getCameraModels() {
  const supabase = await createClient()
  
  // Get current user's profile to find their dealer_id
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
    // If no dealer_id, return empty array (sales users must have a dealer)
    console.log('getCameraModels: No dealer_id for user:', user.id)
    return []
  }
  
  // First, get all camera IDs assigned to this dealer
  const { data: dealerCameras, error: dealerCamerasError } = await supabase
    .from('dealer_cameras')
    .select('camera_model_id')
    .eq('dealer_id', profile.dealer_id)
  
  if (dealerCamerasError) {
    console.error('getCameraModels: Error fetching dealer cameras:', dealerCamerasError)
    return []
  }
  
  if (!dealerCameras || dealerCameras.length === 0) {
    console.log('getCameraModels: No cameras assigned to dealer:', profile.dealer_id)
    return []
  }
  
  // Extract camera model IDs
  const cameraModelIds = dealerCameras
    .map((dc: any) => dc.camera_model_id)
    .filter((id: any) => id !== null && id !== undefined)
  
  if (cameraModelIds.length === 0) {
    return []
  }
  
  // Now fetch only those camera models that are active
  const { data: cameras, error: camerasError } = await supabase
    .from('camera_models')
    .select('id, name')
    .in('id', cameraModelIds)
    .eq('is_active', true)
  
  if (camerasError) {
    console.error('getCameraModels: Error fetching camera models:', camerasError)
    return []
  }
  
  // Sort and return
  const cameraModels = (cameras || [])
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
  
  console.log('getCameraModels: Found', cameraModels.length, 'active cameras for dealer:', profile.dealer_id)
  
  return cameraModels
}

