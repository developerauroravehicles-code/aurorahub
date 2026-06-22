import type { SupabaseClient } from '@supabase/supabase-js'
import { diagnosisLabel } from '@/lib/customer-service-record-utils'
import type { CustomerServiceRecord } from '@/types/customer-service-record'

/**
 * Notify all aurora_manager users that a customer service record needs review.
 */
export async function notifyServiceRecordPending(
  supabase: SupabaseClient,
  record: Pick<
    CustomerServiceRecord,
    'id' | 'demand_number' | 'vehicle_summary' | 'diagnosis_code' | 'diagnosis_other' | 'customer_firstname'
  >
): Promise<{ notified: number }> {
  const { data: managers } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'aurora_manager')

  if (!managers?.length) {
    return { notified: 0 }
  }

  const diagnosis = diagnosisLabel(record.diagnosis_code, record.diagnosis_other)
  const payload = {
    recordId: record.id,
    demandNumber: record.demand_number,
    vehicleSummary: record.vehicle_summary,
    customerFirstname: record.customer_firstname,
    diagnosisCode: record.diagnosis_code,
    diagnosis,
    link: '/dashboard/admin/service-records?status=pending_approval',
    message: `New service request from ${record.customer_firstname?.trim() || 'customer'} — ${diagnosis}`,
  }

  const { error } = await supabase.from('comm_notifications').insert(
    managers.map((m: { id: string }) => ({
      user_id: m.id,
      type: 'service_record_pending' as const,
      payload,
    }))
  )

  if (error) {
    console.error('notifyServiceRecordPending failed:', error.message)
    return { notified: 0 }
  }

  return { notified: managers.length }
}
