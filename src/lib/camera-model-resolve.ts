import type { SupabaseClient } from '@supabase/supabase-js'

/** Resolve catalog camera_models.id from display name (case-insensitive trim). */
export async function lookupCameraModelId(
  supabase: SupabaseClient,
  cameraName: string
): Promise<string | null> {
  const t = cameraName.trim()
  if (!t) return null

  const { data: rows, error } = await supabase.from('camera_models').select('id, name, is_active')

  if (error || !rows?.length) return null

  const normalized = t.toLowerCase()
  const found = rows.find(
    (r) =>
      (r.is_active !== false) &&
      String(r.name ?? '')
        .trim()
        .toLowerCase() === normalized
  )
  return found?.id ?? null
}
