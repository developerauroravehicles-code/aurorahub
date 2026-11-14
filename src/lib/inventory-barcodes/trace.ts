import type { SupabaseClient } from '@supabase/supabase-js'
import { queryBarcodeRegistry } from './registry-query'

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
  const search = options.search?.trim()
  const limit = search ? Math.max(options.limit ?? 300, 500) : options.limit ?? 300
  return queryBarcodeRegistry(supabase, { search, limit, kind: 'all' })
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
