import type { SupabaseClient } from '@supabase/supabase-js'

export type DealerCameraOption = { id: string; name: string }

/**
 * Cameras assigned to a dealer for booking/demand forms, ordered by dealer_cameras.sort_order then name.
 */
export async function getActiveCamerasForDealer(
  supabase: SupabaseClient,
  dealerId: string
): Promise<DealerCameraOption[]> {
  const { data, error } = await supabase
    .from('dealer_cameras')
    .select('sort_order, camera_models(id, name, is_active)')
    .eq('dealer_id', dealerId)

  if (error) {
    console.error('getActiveCamerasForDealer:', error.message)
    return []
  }

  const rows = (data ?? [])
    .map((row) => {
      const cmRaw = row.camera_models as
        | { id: string; name: string; is_active: boolean }
        | { id: string; name: string; is_active: boolean }[]
        | null
      const cm = Array.isArray(cmRaw) ? cmRaw[0] : cmRaw
      if (!cm?.is_active) return null
      return {
        id: cm.id,
        name: cm.name,
        sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order ?? 0),
      }
    })
    .filter((r): r is { id: string; name: string; sort_order: number } => r != null)

  rows.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))

  return rows.map(({ id, name }) => ({ id, name }))
}
