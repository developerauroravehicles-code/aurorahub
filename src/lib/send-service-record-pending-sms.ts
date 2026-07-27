import { createAdminClient } from '@/lib/supabase/admin'
import { logSmsSent } from '@/lib/sms-logger'
import { getSmsSettings } from '@/lib/sms-resolver'
import { sendSMS } from '@/lib/twilio'
import { diagnosisLabel } from '@/lib/customer-service-record-utils'
import type { CustomerServiceRecord } from '@/types/customer-service-record'

export type SendServiceRecordPendingSmsResult =
  | { ok: true; sent: number }
  | { ok: false; error: string; sent: number }

export function buildServiceRecordPendingSmsBody(
  record: Pick<
    CustomerServiceRecord,
    'customer_firstname' | 'vehicle_summary' | 'diagnosis_code' | 'diagnosis_other' | 'demand_number'
  >,
  signature: string
): string {
  const name = record.customer_firstname?.trim() || 'Customer'
  const vehicle = record.vehicle_summary?.trim() || 'vehicle'
  const diagnosis = diagnosisLabel(record.diagnosis_code, record.diagnosis_other)
  const ref = record.demand_number ? `#${record.demand_number}` : ''
  const sig = signature.trim() || 'Aurora Vehicles Incorporation'
  const portalBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://aurorahub.app')
  const portalUrl = `${portalBase}/customer-portal`

  return `Service Request — Review Needed

${name} · ${vehicle} ${ref}
Issue: ${diagnosis}

Review in AuroraHub or customer portal: ${portalUrl}

${sig}`
}

/** SMS all Aurora Managers when a customer service record is submitted. */
export async function sendServiceRecordPendingSmsToManagers(
  record: Pick<
    CustomerServiceRecord,
    'id' | 'demand_id' | 'demand_number' | 'customer_firstname' | 'vehicle_summary' | 'diagnosis_code' | 'diagnosis_other'
  >
): Promise<SendServiceRecordPendingSmsResult> {
  const admin = createAdminClient()
  const { data: managers } = await admin
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'aurora_manager')

  const withPhone = (managers ?? []).filter((m) => m.phone?.trim())
  if (!withPhone.length) {
    return { ok: false, error: 'No Aurora Manager phone numbers configured.', sent: 0 }
  }

  const settings = await getSmsSettings(admin)
  const body = buildServiceRecordPendingSmsBody(record, settings.signature)

  let sent = 0
  for (const manager of withPhone) {
    const phone = manager.phone!.trim()
    const result = await sendSMS(phone, body)
    if (result.success) {
      sent += 1
      await logSmsSent({
        phoneNumber: phone,
        recipientType: 'aurora_manager',
        recipientName: manager.full_name ?? undefined,
        demandId: record.demand_id,
        messageType: 'service_record_pending',
        triggeredBy: 'system',
        messageContent: body,
      })
    }
  }

  if (sent === 0) {
    return { ok: false, error: 'SMS could not be sent to any Aurora Manager.', sent: 0 }
  }

  return { ok: true, sent }
}
