import type { SupabaseClient } from '@supabase/supabase-js'
import {
  bucketActorRole,
  type DemandFieldChange,
} from '@/lib/demand-field-updates'
function roleLabel(bucket: ReturnType<typeof bucketActorRole>): string {
  switch (bucket) {
    case 'aurora_manager':
      return 'Aurora Manager'
    case 'specialist':
      return 'Specialist'
    case 'finance':
      return 'Finance'
    default:
      return 'User'
  }
}

/**
 * Notify the other side when demand fields change:
 * - AM/IM/GM/finance edit → assigned specialist
 * - Specialist edit → all Aurora Managers
 * - Finance also notifies Aurora Managers
 */
export async function notifyDemandFieldsUpdated(
  supabase: SupabaseClient,
  input: {
    demandId: string
    demandNumber?: string | number | null
    actorId: string
    actorRole: string
    actorName?: string
    assignedSpecialistId?: string | null
    fieldChanges: DemandFieldChange[]
    customerLabel?: string
  }
): Promise<{ notified: number }> {
  const bucket = bucketActorRole(input.actorRole)
  const labels = input.fieldChanges.map((c) => c.label)
  const labelSummary =
    labels.length <= 3 ? labels.join(', ') : `${labels.slice(0, 3).join(', ')} +${labels.length - 3} more`

  const ref =
    input.demandNumber != null && input.demandNumber !== ''
      ? `#${input.demandNumber}`
      : input.demandId.slice(0, 8)
  const who = input.actorName?.trim() || roleLabel(bucket)
  const customer = input.customerLabel?.trim()
  const message = customer
    ? `${customer} (${ref}): ${labelSummary} updated by ${who}`
    : `Demand ${ref}: ${labelSummary} updated by ${who}`

  const payload = {
    demandId: input.demandId,
    demandNumber: input.demandNumber ?? null,
    message,
    fieldLabels: labels,
    updatedByRole: bucket,
    updatedByName: who,
    linkAdmin: `/dashboard/admin/demands/${input.demandId}`,
    linkSpecialist: `/dashboard/specialist/work?demand=${input.demandId}`,
  }

  const recipientIds = new Set<string>()

  if (bucket === 'specialist') {
    const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'aurora_manager')
    for (const m of managers ?? []) {
      if (m.id !== input.actorId) recipientIds.add(m.id)
    }
  } else {
    const specialistId = input.assignedSpecialistId?.trim()
    if (specialistId && specialistId !== input.actorId) {
      recipientIds.add(specialistId)
    }
    if (bucket === 'finance') {
      const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'aurora_manager')
      for (const m of managers ?? []) {
        if (m.id !== input.actorId) recipientIds.add(m.id)
      }
    }
  }

  if (recipientIds.size === 0) return { notified: 0 }

  const { data: recipientProfiles } = await supabase
    .from('profiles')
    .select('id, role')
    .in('id', [...recipientIds])

  const roleByUser = new Map(
    (recipientProfiles ?? []).map((p: { id: string; role: string }) => [p.id, p.role])
  )

  const rows = [...recipientIds].map((userId) => {
    const isSpecialist = roleByUser.get(userId) === 'specialist'
    return {
      user_id: userId,
      type: 'demand_fields_updated' as const,
      payload: {
        ...payload,
        link: isSpecialist ? payload.linkSpecialist : payload.linkAdmin,
      },
    }
  })

  const { error } = await supabase.from('comm_notifications').insert(rows)
  if (error) {
    console.error('notifyDemandFieldsUpdated insert failed:', error.message)
    return { notified: 0 }
  }

  return { notified: rows.length }
}
