import type { SupabaseClient } from '@supabase/supabase-js'

export type DealerCameraOption = { id: string; name: string; label: string }

/**
 * Cameras assigned to a dealer for booking/demand forms, ordered by dealer_cameras.sort_order then name.
 */
export async function getActiveCamerasForDealer(
  supabase: SupabaseClient,
  dealerId: string
): Promise<DealerCameraOption[]> {
  const { data, error } = await supabase
    .from('dealer_cameras')
    .select('sort_order, camera_models(id, name, is_active, booking_display_as_set)')
    .eq('dealer_id', dealerId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('getActiveCamerasForDealer:', error.message)
    return []
  }

  const rows = (data ?? [])
    .map((row) => {
      const cmRaw = row.camera_models as
        | { id: string; name: string; is_active: boolean; booking_display_as_set?: boolean }
        | { id: string; name: string; is_active: boolean; booking_display_as_set?: boolean }[]
        | null
      const cm = Array.isArray(cmRaw) ? cmRaw[0] : cmRaw
      if (!cm?.is_active) return null
      const label = cm.booking_display_as_set ? `Set — ${cm.name}` : cm.name
      return {
        id: cm.id,
        name: cm.name,
        label,
        sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order ?? 0),
      }
    })
    .filter(
      (r): r is { id: string; name: string; label: string; sort_order: number } => r != null
    )

  rows.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))

  return rows.map(({ id, name, label }) => ({ id, name, label }))
}
