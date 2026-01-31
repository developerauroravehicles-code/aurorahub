'use server'

import { createClient } from '@/lib/supabase/server'

export async function getCameraModels() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('camera_models')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })
  
  if (error) {
    console.error('Error fetching camera models:', error)
    return []
  }
  
  return data || []
}

