'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveCamerasForDealer } from '@/lib/dealer-camera-catalog'

/** Active cameras assigned to the given dealer, in display order. */
export async function getCameraModelsForDealer(dealerId: string) {
  if (!dealerId) return []

  const supabase = await createClient()
  return getActiveCamerasForDealer(supabase, dealerId)
}
