'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { recordServiceCompletionEarning } from '@/lib/service-record-payroll'
import type { CustomerServiceRecord, ServiceRecordExpense } from '@/types/customer-service-record'

async function verifySpecialist() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, userId: null, supabase: null }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'specialist') {
    return { error: 'Only specialists can access service records' as const, userId: null, supabase: null }
  }

  return { error: null, userId: user.id, supabase }
}

export async function fetchAssignedServiceRecords(): Promise<CustomerServiceRecord[]> {
  const auth = await verifySpecialist()
  if (auth.error || !auth.userId || !auth.supabase) return []

  const { data } = await auth.supabase
    .from('customer_service_records')
    .select('*')
    .eq('assigned_specialist_id', auth.userId)
    .in('status', ['assigned', 'in_progress'])
    .order('service_appointment_at', { ascending: true })

  return (data ?? []) as CustomerServiceRecord[]
}

export async function startServiceRecord(recordId: string): Promise<{ error?: string; success?: boolean }> {
  const auth = await verifySpecialist()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const { error } = await auth.supabase
    .from('customer_service_records')
    .update({ status: 'in_progress' })
    .eq('id', recordId)
    .eq('assigned_specialist_id', auth.userId)
    .eq('status', 'assigned')

  if (error) return { error: error.message }
  revalidatePath('/dashboard/specialist/service-records')
  return { success: true }
}

export async function completeServiceRecord(
  recordId: string,
  completionNotes?: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await verifySpecialist()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const now = new Date().toISOString()
  const notes = (completionNotes ?? '').trim().slice(0, 500)

  const { error } = await auth.supabase
    .from('customer_service_records')
    .update({
      status: 'completed',
      completed_at: now,
      completed_by: auth.userId,
      completion_notes: notes,
    })
    .eq('id', recordId)
    .eq('assigned_specialist_id', auth.userId)
    .in('status', ['assigned', 'in_progress'])

  if (error) return { error: error.message }

  const admin = createAdminClient()
  const payroll = await recordServiceCompletionEarning(admin, recordId, auth.userId)
  if (!payroll.ok) {
    return { error: payroll.error ?? 'Job marked complete but payroll could not be recorded.' }
  }

  revalidatePath('/dashboard/specialist/service-records')
  revalidatePath('/dashboard/admin/service-records')
  revalidatePath('/dashboard/hr/payroll')
  return { success: true }
}

export async function submitServiceRecordExpense(
  recordId: string,
  description: string,
  amount: number,
  category: 'travel' | 'meals' | 'other'
): Promise<{ error?: string; success?: boolean }> {
  const auth = await verifySpecialist()
  if (auth.error || !auth.userId || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const parsedAmount = Math.round(parseFloat(String(amount)) * 100) / 100
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return { error: 'Enter a valid expense amount.' }
  }

  const desc = description.trim().slice(0, 300)
  if (!desc) return { error: 'Expense description is required.' }

  const { data: record } = await auth.supabase
    .from('customer_service_records')
    .select('id, status')
    .eq('id', recordId)
    .eq('assigned_specialist_id', auth.userId)
    .single()

  if (!record) return { error: 'Service record not found or not assigned to you.' }
  if (!['assigned', 'in_progress', 'completed'].includes(record.status)) {
    return { error: 'Expenses can only be submitted for active or completed jobs.' }
  }

  const { error } = await auth.supabase.from('service_record_expenses').insert({
    service_record_id: recordId,
    description: desc,
    amount: parsedAmount,
    category,
    submitted_by: auth.userId,
    status: 'pending',
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/specialist/service-records')
  revalidatePath('/dashboard/admin/service-records')
  return { success: true }
}

export async function fetchExpensesForRecord(recordId: string): Promise<ServiceRecordExpense[]> {
  const auth = await verifySpecialist()
  if (auth.error || !auth.userId || !auth.supabase) return []

  const { data: record } = await auth.supabase
    .from('customer_service_records')
    .select('id')
    .eq('id', recordId)
    .eq('assigned_specialist_id', auth.userId)
    .single()

  if (!record) return []

  const { data } = await auth.supabase
    .from('service_record_expenses')
    .select('*')
    .eq('service_record_id', recordId)
    .order('created_at', { ascending: false })

  return (data ?? []) as ServiceRecordExpense[]
}
