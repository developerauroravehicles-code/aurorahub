import type { SupabaseClient } from '@supabase/supabase-js'

export interface BarcodeTraceRow {
  id: string
  code: string
  kind: string
  status: string
  camera_model_id: string | null
  camera_model_name: string | null
  dealer_id: string | null
  dealer_name: string | null
  specialist_id: string | null
  specialist_name: string | null
  demand_id: string | null
  demand_number: string | null
  demand_status: string | null
  customer_firstname: string | null
  customer_lastname: string | null
  customer_phone: string | null
  consumed_at: string | null
  batch_id: string
  parent_barcode_id: string | null
  created_at: string
}

export interface BarcodeEventTraceRow {
  id: string
  event_type: string
  created_at: string
  actor_name: string | null
  demand_id: string | null
  metadata: Record<string, unknown>
}

export async function fetchBarcodeRegistry(
  supabase: SupabaseClient,
  options: { search?: string; limit?: number } = {}
): Promise<BarcodeTraceRow[]> {
  let query = supabase
    .from('inventory_barcodes')
    .select(
      `
      id, code, kind, status, camera_model_id, dealer_id, specialist_id,
      demand_id, consumed_at, batch_id, parent_barcode_id, created_at,
      camera_models(name),
      dealers(name),
      profiles!inventory_barcodes_specialist_id_fkey(full_name),
      demands(demand_number, status, customer_firstname, customer_lastname, customer_phone)
    `
    )
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 300)

  if (options.search?.trim()) {
    query = query.ilike('code', `%${options.search.trim()}%`)
  }

  const { data } = await query

  return (data ?? []).map((row) => {
    const dealersRaw = row.dealers as { name: string } | { name: string }[] | null
    const profilesRaw = row.profiles as { full_name: string } | { full_name: string }[] | null
    const cameraModelsRaw = row.camera_models as { name: string } | { name: string }[] | null
    const demandsRaw = row.demands as
      | {
          demand_number: string
          status: string
          customer_firstname: string
          customer_lastname: string
          customer_phone: string
        }
      | {
          demand_number: string
          status: string
          customer_firstname: string
          customer_lastname: string
          customer_phone: string
        }[]
      | null

    const dealers = Array.isArray(dealersRaw) ? dealersRaw[0] : dealersRaw
    const profiles = Array.isArray(profilesRaw) ? profilesRaw[0] : profilesRaw
    const cameraModels = Array.isArray(cameraModelsRaw) ? cameraModelsRaw[0] : cameraModelsRaw
    const demands = Array.isArray(demandsRaw) ? demandsRaw[0] : demandsRaw

    return {
      id: row.id,
      code: row.code,
      kind: row.kind,
      status: row.status,
      camera_model_id: row.camera_model_id,
      camera_model_name: cameraModels?.name ?? null,
      dealer_id: row.dealer_id,
      dealer_name: dealers?.name ?? null,
      specialist_id: row.specialist_id,
      specialist_name: profiles?.full_name ?? null,
      demand_id: row.demand_id,
      demand_number: demands?.demand_number ?? null,
      demand_status: demands?.status ?? null,
      customer_firstname: demands?.customer_firstname ?? null,
      customer_lastname: demands?.customer_lastname ?? null,
      customer_phone: demands?.customer_phone ?? null,
      consumed_at: row.consumed_at,
      batch_id: row.batch_id,
      parent_barcode_id: row.parent_barcode_id,
      created_at: row.created_at,
    }
  })
}

export async function fetchBarcodeEvents(
  supabase: SupabaseClient,
  barcodeId: string
): Promise<BarcodeEventTraceRow[]> {
  const { data } = await supabase
    .from('inventory_barcode_events')
    .select('id, event_type, created_at, demand_id, metadata, profiles(full_name)')
    .eq('barcode_id', barcodeId)
    .order('created_at', { ascending: true })

  return (data ?? []).map((row) => {
    const profilesRaw = row.profiles as { full_name: string } | { full_name: string }[] | null
    const profiles = Array.isArray(profilesRaw) ? profilesRaw[0] : profilesRaw
    return {
      id: row.id,
      event_type: row.event_type,
      created_at: row.created_at,
      actor_name: profiles?.full_name ?? null,
      demand_id: row.demand_id,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    }
  })
}

export async function fetchSetTemplates(supabase: SupabaseClient) {
  const { data: templates } = await supabase
    .from('inventory_barcode_set_templates')
    .select('id, name, code, description, created_at')
    .order('name')

  if (!templates?.length) return []

  const { data: items } = await supabase
    .from('inventory_barcode_set_template_items')
    .select('id, template_id, camera_model_id, quantity, camera_models(name)')

  return templates.map((t) => ({
    ...t,
    items: (items ?? [])
      .filter((i) => i.template_id === t.id)
      .map((i) => {
        const cm = i.camera_models as { name: string } | { name: string }[] | null
        const camera_models = Array.isArray(cm) ? cm[0] : cm
        return { ...i, camera_models: camera_models ?? null }
      }),
  }))
}
