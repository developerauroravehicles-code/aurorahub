'use server'

import { createClient } from '@/lib/supabase/server'

export async function getCameraModelsForDealer(dealerId: string) {
  const supabase = await createClient()

  const { data: dealerCameras } = await supabase
    .from('dealer_cameras')
    .select('camera_model_id')
    .eq('dealer_id', dealerId)

  if (!dealerCameras?.length) {
    const { data: allCameras } = await supabase
      .from('camera_models')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    return allCameras ?? []
  }

  const ids = dealerCameras.map((dc: { camera_model_id: string }) => dc.camera_model_id).filter(Boolean)
  const { data: cameras } = await supabase
    .from('camera_models')
    .select('id, name')
    .in('id', ids)
    .eq('is_active', true)
    .order('name')

  return cameras ?? []
}
