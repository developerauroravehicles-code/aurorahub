'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { DEFAULT_SERVICE_LOCATION } from '@/lib/customer-service-record-utils'
import { sendServiceRecordAppointmentSms } from '@/lib/send-service-record-sms'
import { recordExpenseReimbursement, recordServiceCompletionEarning } from '@/lib/service-record-payroll'
import { ptDatetimeLocalToISO } from '@/lib/timezone-defaults'
import type {
  CustomerServiceRecord,
  ServiceRecordExpense,
  SpecialistOption,
} from '@/types/customer-service-record'

async function verifyAuroraManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, userId: null, supabase: null }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can manage service records' as const, userId: null, supabase: null }
  }

  return { error: null, userId: user.id, supabase }
}

export async function getSpecialistsForDealer(dealerName: string): Promise<SpecialistOption[]> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.supabase) return []

  const { data: dealer } = await auth.supabase
    .from('dealers')
    .select('id')
    .eq('name', dealerName)
    .maybeSingle()

  if (!dealer?.id) {
    const { data: allSpecialists } = await auth.supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'specialist')
      .order('full_name')
    return (allSpecialists ?? []) as SpecialistOption[]
  }

  const { data: linked } = await auth.supabase
    .from('specialist_dealers')
    .select('specialist_id')
    .eq('dealer_id', dealer.id)

  const specialistIds = (linked ?? []).map((row) => row.specialist_id).filter(Boolean)
  if (specialistIds.length > 0) {
    const { data: profiles } = await auth.supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', specialistIds)
      .eq('role', 'specialist')
      .order('full_name')
    return (profiles ?? []) as SpecialistOption[]
  }

  const { data: fallback } = await auth.supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'specialist')
    .order('full_name')

  return (fallback ?? []) as SpecialistOption[]
}

export async function rejectServiceRecord(
  recordId: string,
  rejectionReason?: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const supabase = auth.supabase
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
  specialistId: string,
  serviceLocation?: string
): Promise<{ error?: string; success?: boolean; smsWarning?: string }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  if (!specialistId?.trim()) {
    return { error: 'Please select a specialist to assign this service job.' }
  }

  if (!appointmentLocal?.includes('T')) {
    return { error: 'Please select a valid appointment date and time (Pacific Time).' }
  }

  const appointmentIso = ptDatetimeLocalToISO(appointmentLocal)
  const location = (serviceLocation ?? DEFAULT_SERVICE_LOCATION).trim() || DEFAULT_SERVICE_LOCATION
  const now = new Date().toISOString()

  const supabase = auth.supabase
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

  const { data: specialist } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', specialistId)
    .single()

  if (!specialist || specialist.role !== 'specialist') {
    return { error: 'Selected specialist is invalid.' }
  }

  const { error: updateError } = await supabase
    .from('customer_service_records')
    .update({
      status: 'assigned',
      service_appointment_at: appointmentIso,
      service_location: location,
      assigned_specialist_id: specialistId,
      assigned_at: now,
      reviewed_by: auth.userId,
      reviewed_at: now,
    })
    .eq('id', recordId)

  if (updateError) return { error: updateError.message }

  const updatedRecord: CustomerServiceRecord = {
    ...record,
    status: 'assigned',
    service_appointment_at: appointmentIso,
    service_location: location,
    assigned_specialist_id: specialistId,
    assigned_at: now,
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
  revalidatePath('/dashboard/specialist/service-records')
  return { success: true, smsWarning }
}

export async function fetchPendingExpenses(): Promise<ServiceRecordExpense[]> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.supabase) return []

  const { data } = await auth.supabase
    .from('service_record_expenses')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100)

  return (data ?? []) as ServiceRecordExpense[]
}

export async function approveServiceRecordExpense(
  expenseId: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const supabase = auth.supabase
  const { data: expense, error: fetchErr } = await supabase
    .from('service_record_expenses')
    .select('*')
    .eq('id', expenseId)
    .single()

  if (fetchErr || !expense) return { error: 'Expense not found.' }
  if (expense.status !== 'pending') return { error: 'Only pending expenses can be approved.' }

  const { error } = await supabase
    .from('service_record_expenses')
    .update({
      status: 'approved',
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', expenseId)

  if (error) return { error: error.message }

  const admin = createAdminClient()
  const payrollResult = await recordExpenseReimbursement(admin, expenseId)
  if (!payrollResult.ok) {
    return { error: payrollResult.error ?? 'Expense approved but payroll recording failed.' }
  }

  revalidatePath('/dashboard/admin/service-records')
  revalidatePath('/dashboard/hr/payroll')
  return { success: true }
}

export async function rejectServiceRecordExpense(
  expenseId: string,
  rejectionReason?: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const { error } = await auth.supabase
    .from('service_record_expenses')
    .update({
      status: 'rejected',
      rejection_reason: (rejectionReason ?? '').trim().slice(0, 500),
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', expenseId)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/service-records')
  return { success: true }
}

export async function markServiceRecordInProgress(
  recordId: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const { error } = await auth.supabase
    .from('customer_service_records')
    .update({ status: 'in_progress' })
    .eq('id', recordId)
    .in('status', ['assigned', 'scheduled'])

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/service-records')
  return { success: true }
}

export { recordServiceCompletionEarning }
