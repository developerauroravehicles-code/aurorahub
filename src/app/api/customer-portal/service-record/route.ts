import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyServiceRecordPending } from '@/lib/notify-service-record-pending'
import { sendServiceRecordPendingSmsToManagers } from '@/lib/send-service-record-pending-sms'
import type { CustomerServiceRecord } from '@/types/customer-service-record'

/**
 * Create a customer service record (portal) and notify Aurora Managers (in-app + SMS).
 */
export async function POST(request: Request) {
  let body: {
    vin_query?: string
    demand_number?: string
    diagnosis_code?: string
    comment?: string | null
    diagnosis_other?: string | null
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('customer_portal_create_service_record', {
    p_vin_query: body.vin_query ?? '',
    p_demand_number: body.demand_number ?? '',
    p_diagnosis_code: body.diagnosis_code ?? '',
    p_comment: body.comment ?? null,
    p_diagnosis_other: body.diagnosis_other ?? null,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  const result = data as { ok?: boolean; error?: string; id?: string } | null
  if (!result?.ok || !result.id) {
    return NextResponse.json({ ok: false, error: result?.error ?? 'Could not create service record.' }, { status: 400 })
  }

  const { data: record } = await supabase
    .from('customer_service_records')
    .select('*')
    .eq('id', result.id)
    .single()

  if (record) {
    await notifyServiceRecordPending(supabase, record as CustomerServiceRecord)
    await sendServiceRecordPendingSmsToManagers(record as CustomerServiceRecord)
  }

  return NextResponse.json(result)
}
