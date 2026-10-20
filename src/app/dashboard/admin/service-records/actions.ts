'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { DEFAULT_SERVICE_LOCATION } from '@/lib/customer-service-record-utils'
import { sendServiceRecordAppointmentSms } from '@/lib/send-service-record-sms'
import { recordExpenseReimbursement, recordServiceCompletionEarning } from '@/lib/service-record-payroll'
import { validateAppointmentSlot } from '@/app/dashboard/system-management/calendar/actions'
import { isSpecialistDoubleBooked } from '@/lib/scheduling-pool'
import type {
  CustomerServiceRecord,
  ServiceRecordDiagnosisCode,
  ServiceRecordExpense,
  SpecialistOption,
} from '@/types/customer-service-record'

const VALID_DIAGNOSIS: ServiceRecordDiagnosisCode[] = [
  'camera_not_recording',
  'sd_card_issue',
  'power_wiring_issue',
  'app_connectivity_issue',
  'display_monitor_issue',
  'other',
]

export type DemandLookupForServiceRequest = {
  demand_id: string
  demand_number: string
  vin_last6: string
  customer_firstname: string
  customer_phone: string
  vehicle_summary: string
  dealer_id: string
  dealer_name: string
}

function normalizeVinKey(raw: string): string | null {
  const q = raw.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (q.length < 6) return null
  return q.slice(-6)
}

async function resolveDealerIdForRecord(
  supabase: NonNullable<Awaited<ReturnType<typeof verifyAuroraManager>>['supabase']>,
  record: Pick<CustomerServiceRecord, 'dealer_id' | 'demand_id' | 'dealer_name'>
): Promise<string | null> {
  if (record.dealer_id) return record.dealer_id
  const { data: demand } = await supabase
    .from('demands')
    .select('dealer_id')
    .eq('id', record.demand_id)
    .maybeSingle()
  if (demand?.dealer_id) return demand.dealer_id
  if (record.dealer_name?.trim()) {
    const { data: dealer } = await supabase
      .from('dealers')
      .select('id')
      .eq('name', record.dealer_name.trim())
      .maybeSingle()
    return dealer?.id ?? null
  }
  return null
}

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

export async function getSpecialistsForDealer(dealerId: string): Promise<SpecialistOption[]> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.supabase) return []

  const trimmedId = dealerId?.trim()
  if (!trimmedId) {
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
    .eq('dealer_id', trimmedId)

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

export async function lookupDemandForServiceRequest(
  demandNumber: string,
  vinLast6: string
): Promise<DemandLookupForServiceRequest | { error: string }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const dn = demandNumber.trim()
  const vk = normalizeVinKey(vinLast6)
  if (!dn) return { error: 'Demand reference is required.' }
  if (!vk) return { error: 'VIN last 6 is required.' }

  const { data: demand, error } = await auth.supabase
    .from('demands')
    .select(
      'id, demand_number, vin_last6, customer_firstname, customer_phone, vehicle_year, vehicle_make, vehicle_model, status, dealer_id, dealers(name)'
    )
    .eq('demand_number', dn)
    .maybeSingle()

  if (error || !demand) {
    return { error: 'No completed installation found for this reference and VIN.' }
  }

  const demandVin = (demand.vin_last6 ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (demandVin !== vk) {
    return { error: 'No completed installation found for this reference and VIN.' }
  }
  if ((demand.status ?? '').toLowerCase() !== 'completed') {
    return { error: 'Service requests require a completed installation.' }
  }
  if (!demand.customer_phone?.trim()) {
    return { error: 'This installation has no customer phone on file.' }
  }
  if (!demand.dealer_id) {
    return { error: 'This installation has no dealer assigned.' }
  }

  const { data: pending } = await auth.supabase
    .from('customer_service_records')
    .select('id')
    .eq('demand_id', demand.id)
    .eq('status', 'pending_approval')
    .maybeSingle()

  if (pending) {
    return { error: 'A service request is already pending review for this installation.' }
  }

  const dealerJoin = demand.dealers as { name?: string } | { name?: string }[] | null
  const dealerName = Array.isArray(dealerJoin)
    ? dealerJoin[0]?.name ?? ''
    : dealerJoin?.name ?? ''

  const vehicle_summary = [demand.vehicle_year, demand.vehicle_make, demand.vehicle_model]
    .filter(Boolean)
    .join(' ')
    .trim()

  return {
    demand_id: demand.id,
    demand_number: String(demand.demand_number),
    vin_last6: demandVin,
    customer_firstname: demand.customer_firstname ?? '',
    customer_phone: demand.customer_phone.trim(),
    vehicle_summary,
    dealer_id: demand.dealer_id,
    dealer_name: dealerName,
  }
}

export async function createServiceRequestScheduled(input: {
  demandId: string
  diagnosisCode: ServiceRecordDiagnosisCode
  diagnosisOther?: string
  comment?: string
  specialistId: string
  appointmentIso: string
  serviceLocation?: string
}): Promise<{ error?: string; success?: boolean; smsWarning?: string }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  if (!VALID_DIAGNOSIS.includes(input.diagnosisCode)) {
    return { error: 'Invalid issue type.' }
  }
  const other = (input.diagnosisOther ?? '').trim().slice(0, 200)
  const comment = (input.comment ?? '').trim().slice(0, 500)
  if (input.diagnosisCode === 'other' && !other && !comment) {
    return { error: 'Describe the issue when selecting Other.' }
  }

  const { data: demand, error: demandErr } = await auth.supabase
    .from('demands')
    .select(
      'id, demand_number, vin_last6, customer_firstname, customer_phone, vehicle_year, vehicle_make, vehicle_model, status, dealer_id, dealers(name)'
    )
    .eq('id', input.demandId.trim())
    .single()

  if (demandErr || !demand || (demand.status ?? '').toLowerCase() !== 'completed') {
    return { error: 'Completed installation not found.' }
  }
  if (!demand.dealer_id) return { error: 'Dealer is required.' }

  const { data: pending } = await auth.supabase
    .from('customer_service_records')
    .select('id')
    .eq('demand_id', demand.id)
    .eq('status', 'pending_approval')
    .maybeSingle()
  if (pending) {
    return { error: 'A service request is already pending review for this installation.' }
  }

  const dealerJoin = demand.dealers as { name?: string } | { name?: string }[] | null
  const dealerName = Array.isArray(dealerJoin)
    ? dealerJoin[0]?.name ?? ''
    : dealerJoin?.name ?? ''

  const appointmentIso = input.appointmentIso.trim()
  if (!appointmentIso || Number.isNaN(new Date(appointmentIso).getTime())) {
    return { error: 'Select a valid appointment slot.' }
  }

  const slotCheck = await validateAppointmentSlot(demand.dealer_id, appointmentIso)
  if (!slotCheck.valid) {
    return { error: slotCheck.error ?? 'Invalid appointment slot.' }
  }

  const specialistId = input.specialistId.trim()
  const { data: specialist } = await auth.supabase
    .from('profiles')
    .select('id, role')
    .eq('id', specialistId)
    .single()
  if (!specialist || specialist.role !== 'specialist') {
    return { error: 'Selected specialist is invalid.' }
  }

  const doubleBooked = await isSpecialistDoubleBooked(auth.supabase, specialistId, appointmentIso)
  if (doubleBooked) {
    return { error: 'This specialist already has another appointment at that time.' }
  }

  const location = (input.serviceLocation ?? DEFAULT_SERVICE_LOCATION).trim() || DEFAULT_SERVICE_LOCATION
  const now = new Date().toISOString()
  const vehicle_summary = [demand.vehicle_year, demand.vehicle_make, demand.vehicle_model]
    .filter(Boolean)
    .join(' ')
    .trim()

  const { data: inserted, error: insertErr } = await auth.supabase
    .from('customer_service_records')
    .insert({
      demand_id: demand.id,
      demand_number: String(demand.demand_number),
      vin_last6: (demand.vin_last6 ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
      customer_firstname: demand.customer_firstname ?? '',
      customer_phone: demand.customer_phone.trim(),
      vehicle_summary,
      dealer_id: demand.dealer_id,
      dealer_name: dealerName,
      diagnosis_code: input.diagnosisCode,
      diagnosis_other: other,
      comment,
      status: 'assigned',
      service_appointment_at: appointmentIso,
      service_location: location,
      assigned_specialist_id: specialistId,
      assigned_at: now,
      reviewed_by: auth.userId,
      reviewed_at: now,
    })
    .select('*')
    .single()

  if (insertErr || !inserted) {
    return { error: insertErr?.message ?? 'Could not create service request.' }
  }

  const record = inserted as CustomerServiceRecord
  const smsResult = await sendServiceRecordAppointmentSms(record)
  let smsWarning: string | undefined
  if (smsResult.ok) {
    const admin = createAdminClient()
    await admin
      .from('customer_service_records')
      .update({ sms_sent_at: new Date().toISOString() })
      .eq('id', record.id)
  } else {
    smsWarning = smsResult.error
  }

  revalidatePath('/dashboard/admin/service-records')
  revalidatePath('/dashboard/specialist/service-records')
  return { success: true, smsWarning }
}

export async function approveServiceRecord(
  recordId: string,
  appointmentIso: string,
  specialistId: string,
  serviceLocation?: string
): Promise<{ error?: string; success?: boolean; smsWarning?: string }> {
  const auth = await verifyAuroraManager()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  if (!specialistId?.trim()) {
    return { error: 'Please select a specialist to assign this service job.' }
  }

  if (!appointmentIso?.trim() || Number.isNaN(new Date(appointmentIso).getTime())) {
    return { error: 'Please select a valid appointment slot on the dealer calendar.' }
  }

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

  const dealerId = await resolveDealerIdForRecord(supabase, record)
  if (!dealerId) {
    return { error: 'Could not determine dealer for calendar validation.' }
  }

  const slotCheck = await validateAppointmentSlot(dealerId, appointmentIso, {
    excludeServiceRecordId: recordId,
  })
  if (!slotCheck.valid) {
    return { error: slotCheck.error ?? 'Invalid appointment slot.' }
  }

  const { data: specialist } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', specialistId)
    .single()

  if (!specialist || specialist.role !== 'specialist') {
    return { error: 'Selected specialist is invalid.' }
  }

  const doubleBooked = await isSpecialistDoubleBooked(supabase, specialistId, appointmentIso, {
    excludeServiceRecordId: recordId,
  })
  if (doubleBooked) {
    return { error: 'This specialist already has another appointment at that time.' }
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
