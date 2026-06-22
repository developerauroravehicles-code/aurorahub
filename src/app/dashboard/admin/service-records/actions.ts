'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { DEFAULT_SERVICE_LOCATION } from '@/lib/customer-service-record-utils'
import { sendServiceRecordAppointmentSms } from '@/lib/send-service-record-sms'
import { ptDatetimeLocalToISO } from '@/lib/timezone-defaults'
import type { CustomerServiceRecord } from '@/types/customer-service-record'

async function verifyAuroraManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, userId: null }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can manage service records' as const, userId: null }
  }

  return { error: null, userId: user.id }
}

export async function rejectServiceRecord(
  recordId: string,
  rejectionReason?: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.userId) return { error: auth.error ?? 'Unauthorized' }

  const supabase = await createClient()
  const reason = (rejectionReason ?? '').trim().slice(0, 500)

  const { data: existing, error: fetchError } = await supabase
    .from('customer_service_records')
    .select('id, status')
    .eq('id', recordId)
    .single()

  if (fetchError || !existing) return { error: 'Service record not found.' }
  if (existing.status !== 'pending_approval') {
    return { error: 'Only pending records can be rejected.' }
  }

  const { error } = await supabase
    .from('customer_service_records')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/service-records')
  return { success: true }
}

export async function approveServiceRecord(
  recordId: string,
  appointmentLocal: string,
  serviceLocation?: string
): Promise<{ error?: string; success?: boolean; smsWarning?: string }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.userId) return { error: auth.error ?? 'Unauthorized' }

  if (!appointmentLocal?.includes('T')) {
    return { error: 'Please select a valid appointment date and time (Pacific Time).' }
  }

  const appointmentIso = ptDatetimeLocalToISO(appointmentLocal)
  const location = (serviceLocation ?? DEFAULT_SERVICE_LOCATION).trim() || DEFAULT_SERVICE_LOCATION
  const now = new Date().toISOString()

  const supabase = await createClient()
  const { data: existing, error: fetchError } = await supabase
    .from('customer_service_records')
    .select('*')
    .eq('id', recordId)
    .single()

  if (fetchError || !existing) return { error: 'Service record not found.' }
  const record = existing as CustomerServiceRecord
  if (record.status !== 'pending_approval') {
    return { error: 'Only pending records can be approved.' }
  }

  const { error: updateError } = await supabase
    .from('customer_service_records')
    .update({
      status: 'scheduled',
      service_appointment_at: appointmentIso,
      service_location: location,
      reviewed_by: auth.userId,
      reviewed_at: now,
    })
    .eq('id', recordId)

  if (updateError) return { error: updateError.message }

  const updatedRecord: CustomerServiceRecord = {
    ...record,
    status: 'scheduled',
    service_appointment_at: appointmentIso,
    service_location: location,
  }

  const smsResult = await sendServiceRecordAppointmentSms(updatedRecord)
  let smsWarning: string | undefined

  if (smsResult.ok) {
    const admin = createAdminClient()
    await admin
      .from('customer_service_records')
      .update({ sms_sent_at: new Date().toISOString() })
      .eq('id', recordId)
  } else {
    smsWarning = smsResult.error
  }

  revalidatePath('/dashboard/admin/service-records')
  return { success: true, smsWarning }
}
