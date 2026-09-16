import type { SupabaseClient } from '@supabase/supabase-js'

function normalizeName(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Ensures a set template has a booking catalog camera_models row (Set — name)
 * and assigns it to dealers that already carry every component model in the set.
 */
export async function syncSetTemplateDealerBooking(
  adminSupabase: SupabaseClient,
  templateId: string
): Promise<{ bookingCameraModelId?: string; dealersLinked?: number; error?: string }> {
  const { data: template, error: tErr } = await adminSupabase
    .from('inventory_barcode_set_templates')
    .select('id, name, booking_camera_model_id')
    .eq('id', templateId)
    .maybeSingle()

  if (tErr) return { error: tErr.message }
  if (!template) return { error: 'Set template not found' }

  const { data: itemRows, error: iErr } = await adminSupabase
    .from('inventory_barcode_set_template_items')
    .select('camera_model_id, quantity, camera_models(name)')
    .eq('template_id', templateId)

  if (iErr) return { error: iErr.message }
  if (!itemRows?.length) return { error: 'Set template has no products' }

  const componentIds = [...new Set(itemRows.map((r) => r.camera_model_id as string))]
  const bookingName = template.name.trim()

  let bookingCameraModelId = template.booking_camera_model_id as string | null

  if (bookingCameraModelId) {
    const { error: updErr } = await adminSupabase
      .from('camera_models')
      .update({
        name: bookingName,
        is_active: true,
        booking_display_as_set: true,
      })
      .eq('id', bookingCameraModelId)

    if (updErr) return { error: updErr.message }
  } else {
    const { data: allModels } = await adminSupabase.from('camera_models').select('id, name, is_active')

    const existing = (allModels ?? []).find(
      (m) => normalizeName(String(m.name ?? '')) === normalizeName(bookingName)
    )

    if (existing?.id) {
      bookingCameraModelId = existing.id
      await adminSupabase
        .from('camera_models')
        .update({ is_active: true, booking_display_as_set: true, name: bookingName })
        .eq('id', existing.id)
    } else {
      const { data: created, error: insErr } = await adminSupabase
        .from('camera_models')
        .insert({
          name: bookingName,
          is_active: true,
          booking_display_as_set: true,
          stock_quantity: 0,
        })
        .select('id')
        .single()

      if (insErr || !created) return { error: insErr?.message ?? 'Failed to create booking catalog model' }
      bookingCameraModelId = created.id
    }

    await adminSupabase
      .from('inventory_barcode_set_templates')
      .update({ booking_camera_model_id: bookingCameraModelId, updated_at: new Date().toISOString() })
      .eq('id', templateId)
  }

  const { data: dealerLinks, error: dErr } = await adminSupabase
    .from('dealer_cameras')
    .select('dealer_id, camera_model_id')

  if (dErr) return { error: dErr.message }

  const byDealer = new Map<string, Set<string>>()
  for (const row of dealerLinks ?? []) {
    const did = row.dealer_id as string
    const cid = row.camera_model_id as string
    if (!byDealer.has(did)) byDealer.set(did, new Set())
    byDealer.get(did)!.add(cid)
  }

  let dealersLinked = 0

  for (const [dealerId, assigned] of byDealer) {
    const hasAllComponents = componentIds.every((id) => assigned.has(id))
    if (!hasAllComponents) continue

    const { data: lastRow } = await adminSupabase
      .from('dealer_cameras')
      .select('sort_order')
      .eq('dealer_id', dealerId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextSort =
      (typeof lastRow?.sort_order === 'number' ? lastRow.sort_order : Number(lastRow?.sort_order ?? 0)) +
      10

    const { error: linkErr } = await adminSupabase.from('dealer_cameras').insert({
      dealer_id: dealerId,
      camera_model_id: bookingCameraModelId,
      sort_order: nextSort,
    })

    if (!linkErr) {
      dealersLinked += 1
    } else if (linkErr.code !== '23505') {
      return { error: linkErr.message }
    }
  }

  return { bookingCameraModelId: bookingCameraModelId ?? undefined, dealersLinked }
}

/** Sync every set template (e.g. after deploy). */
export async function syncAllSetTemplatesDealerBooking(
  adminSupabase: SupabaseClient
): Promise<{ synced: number; errors: string[] }> {
  const { data: templates } = await adminSupabase.from('inventory_barcode_set_templates').select('id')
  let synced = 0
  const errors: string[] = []
  for (const t of templates ?? []) {
    const result = await syncSetTemplateDealerBooking(adminSupabase, t.id)
    if (result.error) errors.push(`${t.id}: ${result.error}`)
    else synced += 1
  }
  return { synced, errors }
}
