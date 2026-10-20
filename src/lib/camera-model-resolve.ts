import type { SupabaseClient } from '@supabase/supabase-js'

/** Normalize user-facing camera labels for catalog lookup (Set prefix, spacing, optional Aurora). */
export function normalizeCameraModelLookupKey(name: string): string {
  let s = name.trim().replace(/^set\s*[—\-]\s*/i, '')
  s = s.replace(/\s+/g, ' ')
  return s.toLowerCase()
}

function lookupKeysForName(name: string): string[] {
  const base = normalizeCameraModelLookupKey(name)
  if (!base) return []
  const keys = new Set<string>([base])
  const withoutAurora = base.replace(/^aurora\s+/, '').trim()
  if (withoutAurora && withoutAurora !== base) keys.add(withoutAurora)
  const withAurora = base.startsWith('aurora ') ? base : `aurora ${base}`
  keys.add(withAurora)
  return [...keys]
}

/** Resolve catalog camera_models.id from display name (case-insensitive, set label tolerant). */
export async function lookupCameraModelId(
  supabase: SupabaseClient,
  cameraName: string
): Promise<string | null> {
  const t = cameraName.trim()
  if (!t) return null

  const { data: rows, error } = await supabase.from('camera_models').select('id, name, is_active')

  if (error || !rows?.length) return null

  const inputKeys = lookupKeysForName(t)
  const found = rows.find((r) => {
    if (r.is_active === false) return false
    const rowKeys = lookupKeysForName(String(r.name ?? ''))
    return inputKeys.some((ik) => rowKeys.includes(ik))
  })
  return found?.id ?? null
}

/** Verify camera_models.id exists and is active. */
export async function getActiveCameraModelById(
  supabase: SupabaseClient,
  cameraModelId: string
): Promise<{ id: string; name: string } | null> {
  const id = cameraModelId.trim()
  if (!id) return null
  const { data } = await supabase
    .from('camera_models')
    .select('id, name, is_active')
    .eq('id', id)
    .maybeSingle()
  if (!data?.id || data.is_active === false) return null
  return { id: data.id, name: String(data.name ?? '') }
}
