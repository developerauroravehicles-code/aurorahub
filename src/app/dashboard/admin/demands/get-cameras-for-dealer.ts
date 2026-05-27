'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Demand forms use the full active camera catalog. dealerId is retained for callers;
 * inventory consumption is driven by catalog match on completed demands, not by dealer_cameras.
 */
export async function getCameraModelsForDealer(_dealerId: string) {
  const supabase = await createClient()

  const { data: cameras } = await supabase
    .from('camera_models')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return cameras ?? []
}
