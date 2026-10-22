import type { SupabaseClient } from '@supabase/supabase-js'
import { getActiveCameraModelById, lookupCameraModelId } from '@/lib/camera-model-resolve'

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

export async function isCameraModelAssignedToDealer(
  supabase: SupabaseClient,
  dealerId: string,
  cameraModelId: string
): Promise<boolean> {
  if (!dealerId.trim() || !cameraModelId.trim()) return false
  const assigned = await getActiveCamerasForDealer(supabase, dealerId)
  return assigned.some((a) => a.id === cameraModelId)
}

/**
 * Demand booking camera must be one of the dealer's active dealer_cameras rows.
 */
export async function validateDealerBookingCamera(
  supabase: SupabaseClient,
  dealerId: string,
  input: { cameraModelId?: string | null; cameraModelName?: string | null }
): Promise<{ cameraModelId: string; cameraModelName: string } | { error: string }> {
  if (!dealerId.trim()) {
    return { error: 'Dealer is required.' }
  }

  const assigned = await getActiveCamerasForDealer(supabase, dealerId)
  if (assigned.length === 0) {
    return {
      error:
        'No camera models are assigned to this dealer. Assign cameras in System Management before creating or updating a demand.',
    }
  }

  const idFromForm = input.cameraModelId?.trim()
  if (idFromForm) {
    const active = await getActiveCameraModelById(supabase, idFromForm)
    if (!active) {
      return { error: 'Selected camera model is not active in the catalog.' }
    }
    if (!assigned.some((a) => a.id === active.id)) {
      return {
        error: `"${active.name}" is not assigned to this dealer. Choose a camera from the dealer booking list.`,
      }
    }
    return { cameraModelId: active.id, cameraModelName: active.name }
  }

  const name = input.cameraModelName?.trim()
  if (!name) {
    return { error: 'Select a camera model assigned to this dealer.' }
  }

  const byLabel = assigned.find(
    (a) =>
      a.name.toLowerCase() === name.toLowerCase() ||
      (a.label?.toLowerCase() ?? '') === name.toLowerCase()
  )
  if (byLabel) {
    return { cameraModelId: byLabel.id, cameraModelName: byLabel.name }
  }

  const lookedUpId = await lookupCameraModelId(supabase, name)
  if (lookedUpId && assigned.some((a) => a.id === lookedUpId)) {
    const match = assigned.find((a) => a.id === lookedUpId)!
    return { cameraModelId: match.id, cameraModelName: match.name }
  }

  return {
    error: `"${name}" is not assigned to this dealer. Select a camera from the dealer booking list only.`,
  }
}
