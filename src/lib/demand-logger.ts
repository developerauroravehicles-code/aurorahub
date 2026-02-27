import { createAdminClient } from '@/lib/supabase/admin'

export type DemandStatus =
  | 'pending_finance'
  | 'approved'
  | 'completed'
  | 'cancelled'

export interface DemandLogParams {
  demandId: string
  actorId: string
  previousStatus: DemandStatus | null
  newStatus: DemandStatus
  notes?: string
}

/** Insert a demand log entry for audit trail. Uses admin client to bypass RLS. */
export async function logDemandChange(params: DemandLogParams): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('demand_logs').insert({
      demand_id: params.demandId,
      actor_id: params.actorId,
      previous_status: params.previousStatus,
      new_status: params.newStatus,
      notes: params.notes ?? null,
    })
  } catch (err) {
    console.error('Failed to log demand change:', err)
  }
}
