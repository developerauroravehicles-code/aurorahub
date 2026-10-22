import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { logDemandChange, type DemandStatus } from '@/lib/demand-logger'
import { normalizeUserRole } from '@/lib/inventory-manager-access'
import { notifyDemandFieldsUpdated } from '@/lib/notify-demand-fields-updated'

export type DemandFieldKey =
  | 'customer_firstname'
  | 'customer_lastname'
  | 'customer_phone'
  | 'customer_address'
  | 'vehicle_make'
  | 'vehicle_model'
  | 'vehicle_year'
  | 'stock_number'
  | 'vin_last6'
  | 'camera_model'
  | 'appointment_date'
  | 'assigned_specialist_id'
  | 'assigned_finance_id'
  | 'completed_at'

export const DEMAND_FIELD_LABELS: Record<DemandFieldKey, string> = {
  customer_firstname: 'First name',
  customer_lastname: 'Last name',
  customer_phone: 'Phone',
  customer_address: 'Address',
  vehicle_make: 'Vehicle make',
  vehicle_model: 'Vehicle model',
  vehicle_year: 'Vehicle year',
  stock_number: 'Stock number',
  vin_last6: 'VIN (last 6)',
  camera_model: 'Camera model',
  appointment_date: 'Appointment',
  assigned_specialist_id: 'Assigned specialist',
  assigned_finance_id: 'Assigned finance',
  completed_at: 'Completed date',
}

export type DemandFieldChange = {
  field: DemandFieldKey
  label: string
  previous: string | null
  next: string | null
}

export type FieldHighlightBucket = 'aurora_manager' | 'specialist' | 'finance' | 'other'

export type DemandLogMetadata = {
  field_changes?: DemandFieldChange[]
  actor_role?: string
}

const HIGHLIGHT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function normalizeFieldValue(field: DemandFieldKey, value: unknown): string | null {
  if (value == null || value === '') return null
  if (field === 'customer_phone') {
    return String(value).replace(/\D/g, '')
  }
  if (field === 'vehicle_year') {
    return String(value)
  }
  if (field === 'appointment_date' || field === 'completed_at') {
    const d = new Date(String(value))
    return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
  }
  return String(value).trim()
}

export function buildDemandFieldChanges(
  before: Partial<Record<DemandFieldKey, unknown>>,
  after: Partial<Record<DemandFieldKey, unknown>>,
  fields: DemandFieldKey[]
): DemandFieldChange[] {
  const changes: DemandFieldChange[] = []
  for (const field of fields) {
    const prevNorm = normalizeFieldValue(field, before[field])
    const nextNorm = normalizeFieldValue(field, after[field])
    if (prevNorm === nextNorm) continue
    changes.push({
      field,
      label: DEMAND_FIELD_LABELS[field],
      previous: before[field] != null && before[field] !== '' ? String(before[field]) : null,
      next: after[field] != null && after[field] !== '' ? String(after[field]) : null,
    })
  }
  return changes
}

export function bucketActorRole(role: string | null | undefined): FieldHighlightBucket {
  const r = normalizeUserRole(role)
  if (r === 'specialist') return 'specialist'
  if (r === 'finance') return 'finance'
  if (r === 'aurora_manager' || r === 'inventory_manager' || r === 'general_manager') {
    return 'aurora_manager'
  }
  return 'other'
}

export function fieldHighlightClass(bucket: FieldHighlightBucket | undefined): string {
  switch (bucket) {
    case 'aurora_manager':
      return 'ring-2 ring-[#C27E00]/60 bg-[#C27E00]/10 rounded-md px-2 -mx-2 py-0.5'
    case 'specialist':
      return 'ring-2 ring-sky-500/60 bg-sky-500/10 rounded-md px-2 -mx-2 py-0.5'
    case 'finance':
      return 'ring-2 ring-violet-500/60 bg-violet-500/10 rounded-md px-2 -mx-2 py-0.5'
    default:
      return ''
  }
}

function parseLogMetadata(raw: unknown): DemandLogMetadata | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as DemandLogMetadata
}

/** Most recent field update per key (within max age), colored by who edited. */
export function buildLatestFieldHighlights(
  logs: Array<{
    created_at: string
    metadata?: unknown
    profiles?: { role?: string | null } | null
  }>,
  maxAgeMs = HIGHLIGHT_MAX_AGE_MS
): Partial<Record<DemandFieldKey, FieldHighlightBucket>> {
  const cutoff = Date.now() - maxAgeMs
  const out: Partial<Record<DemandFieldKey, FieldHighlightBucket>> = {}

  const sorted = [...logs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  for (const log of sorted) {
    if (new Date(log.created_at).getTime() < cutoff) continue
    const meta = parseLogMetadata(log.metadata)
    const changes = meta?.field_changes
    if (!changes?.length) continue
    const bucket = bucketActorRole(meta?.actor_role ?? log.profiles?.role)
    for (const ch of changes) {
      if (!out[ch.field]) out[ch.field] = bucket
    }
  }

  return out
}

export async function recordDemandFieldUpdates(input: {
  demandId: string
  actorId: string
  actorRole: string
  actorName?: string
  previousStatus: DemandStatus
  newStatus: DemandStatus
  notes?: string
  fieldChanges: DemandFieldChange[]
  assignedSpecialistId?: string | null
  demandNumber?: string | number | null
  customerLabel?: string
}): Promise<void> {
  if (!input.fieldChanges.length) return

  const metadata: DemandLogMetadata = {
    field_changes: input.fieldChanges,
    actor_role: input.actorRole,
  }

  await logDemandChange({
    demandId: input.demandId,
    actorId: input.actorId,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    notes: input.notes ?? 'Demand fields updated',
    metadata,
  })

  try {
    const admin = createAdminClient()
    await notifyDemandFieldsUpdated(admin, {
      demandId: input.demandId,
      demandNumber: input.demandNumber,
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorName: input.actorName,
      assignedSpecialistId: input.assignedSpecialistId,
      fieldChanges: input.fieldChanges,
      customerLabel: input.customerLabel,
    })
  } catch (err) {
    console.error('notifyDemandFieldsUpdated failed:', err)
  }
}

/** Batch-load recent field highlights for many demands (specialist work list). */
export async function fetchFieldHighlightsForDemands(
  admin: SupabaseClient,
  demandIds: string[]
): Promise<Record<string, Partial<Record<DemandFieldKey, FieldHighlightBucket>>>> {
  const result: Record<string, Partial<Record<DemandFieldKey, FieldHighlightBucket>>> = {}
  if (!demandIds.length) return result

  const cutoff = new Date(Date.now() - HIGHLIGHT_MAX_AGE_MS).toISOString()
  const { data: rows } = await admin
    .from('demand_logs')
    .select('demand_id, created_at, metadata')
    .in('demand_id', demandIds)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })

  const byDemand = new Map<string, Array<{ created_at: string; metadata?: unknown }>>()
  for (const row of rows ?? []) {
    const id = row.demand_id as string
    if (!byDemand.has(id)) byDemand.set(id, [])
    byDemand.get(id)!.push({
      created_at: row.created_at as string,
      metadata: row.metadata,
    })
  }

  for (const id of demandIds) {
    result[id] = buildLatestFieldHighlights(byDemand.get(id) ?? [])
  }

  return result
}
