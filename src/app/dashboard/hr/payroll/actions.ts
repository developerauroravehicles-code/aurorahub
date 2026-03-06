'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { calculatePerCompletedAmount, calculateDeductions, calculateGrossFromNet } from './payroll-utils'

const PAYMENT_TYPES = ['salary', 'hourly', 'per_installation', 'per_completed_tiered', 'commission', 'bonus', 'job_based', 'dealer_commission', 'platform_commission'] as const

async function ensureAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', supabase: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'hr' && profile?.role !== 'aurora_manager') {
    return { error: 'Unauthorized', supabase: null }
  }
  return { supabase }
}

// Get completed demands for personnel in date range
// Completed demands assigned to specialist (assigned_specialist_id)
// Uses DB RPC for date accuracy; JS fallback if RPC not available
export async function getCompletedDemandsForPeriod(personnelId: string, periodStart: string, periodEnd: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { count: 0, demands: [], error: 'Not authenticated' }

  // 1) Try RPC first (migration: add_payroll_completed_demands_rpc.sql)
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_completed_demands_for_payroll', {
    p_personnel_id: personnelId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  })

  if (!rpcError && rpcData) {
    const demands = (Array.isArray(rpcData) ? rpcData : []).map((d: {
      id: string
      demand_number: string | null
      completion_date: string
      customer_firstname: string | null
      customer_lastname: string | null
      vehicle_make: string | null
      vehicle_model: string | null
    }) => ({
      id: d.id,
      demand_number: d.demand_number ?? null,
      customer: [d.customer_firstname, d.customer_lastname].filter(Boolean).join(' ') || '—',
      vehicle: [d.vehicle_make, d.vehicle_model].filter(Boolean).join(' ') || '—',
      date: d.completion_date ? new Date(d.completion_date).toLocaleDateString() : '—',
    }))
    return { count: demands.length, demands, error: null }
  }

  // 2) RPC yoksa JS fallback (profile_id / full_name eşleştirme)
  const { data: personnel } = await supabase
    .from('personnel')
    .select('profile_id, full_name')
    .eq('id', personnelId)
    .single()

  if (!personnel) return { count: 0, demands: [], error: 'Personnel not found.' }

  let profileId = personnel.profile_id
  if (!profileId && personnel.full_name) {
    const firstName = personnel.full_name.trim().split(/\s+/)[0] || ''
    if (firstName) {
      const { data: pm } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'specialist')
        .ilike('full_name', `%${firstName}%`)
        .limit(1)
        .maybeSingle()
      profileId = pm?.id ?? undefined
    }
  }

  if (!profileId) {
    return {
      count: 0,
      demands: [],
      error: 'This personnel has no profile link. Check personnel-profile mapping in System Management > Users or run sync_platform_profiles_to_personnel migration.',
    }
  }

  const start = `${periodStart}T00:00:00`
  const end = `${periodEnd}T23:59:59`

  const { data: withCompletedAt } = await supabase
    .from('demands')
    .select('id, demand_number, completed_at, updated_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model')
    .eq('assigned_specialist_id', profileId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .gte('completed_at', start)
    .lte('completed_at', end)

  const { data: withUpdatedAt } = await supabase
    .from('demands')
    .select('id, demand_number, completed_at, updated_at, customer_firstname, customer_lastname, vehicle_make, vehicle_model')
    .eq('assigned_specialist_id', profileId)
    .eq('status', 'completed')
    .is('completed_at', null)
    .gte('updated_at', start)
    .lte('updated_at', end)

  const seen = new Set<string>()
  const demands: { id: string; demand_number: string | null; customer: string; vehicle: string; date: string }[] = []
  for (const d of withCompletedAt ?? []) {
    if (!seen.has(d.id)) {
      seen.add(d.id)
      demands.push({
        id: d.id,
        demand_number: d.demand_number ?? null,
        customer: [d.customer_firstname, d.customer_lastname].filter(Boolean).join(' ') || '—',
        vehicle: [d.vehicle_make, d.vehicle_model].filter(Boolean).join(' ') || '—',
        date: d.completed_at ? new Date(d.completed_at).toLocaleDateString() : (d.updated_at ? new Date(d.updated_at).toLocaleDateString() : '—'),
      })
    }
  }
  for (const d of withUpdatedAt ?? []) {
    if (!seen.has(d.id)) {
      seen.add(d.id)
      demands.push({
        id: d.id,
        demand_number: d.demand_number ?? null,
        customer: [d.customer_firstname, d.customer_lastname].filter(Boolean).join(' ') || '—',
        vehicle: [d.vehicle_make, d.vehicle_model].filter(Boolean).join(' ') || '—',
        date: d.updated_at ? new Date(d.updated_at).toLocaleDateString() : '—',
      })
    }
  }
  demands.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  return { count: demands.length, demands, error: null }
}

// Backward compatible
export async function getCompletedCountForPeriod(personnelId: string, periodStart: string, periodEnd: string) {
  const r = await getCompletedDemandsForPeriod(personnelId, periodStart, periodEnd)
  return { count: r.count, error: r.error }
}


// Compensation structures
export async function createCompensationStructure(formData: {
  personnel_id: string
  payment_type: string
  amount?: number
  effective_from: string
  effective_to?: string
  notes?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const pt = PAYMENT_TYPES.includes(formData.payment_type as (typeof PAYMENT_TYPES)[number]) ? formData.payment_type : 'salary'
  const { error } = await supabase.from('compensation_structures').insert({
    personnel_id: formData.personnel_id,
    payment_type: pt,
    amount: formData.amount ?? null,
    effective_from: formData.effective_from,
    effective_to: formData.effective_to || null,
    notes: formData.notes?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/payroll')
  return { success: true }
}

export async function updateCompensationStructure(
  id: string,
  formData: { amount?: number; effective_to?: string; notes?: string }
) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.amount != null) update.amount = formData.amount
  if (formData.effective_to != null) update.effective_to = formData.effective_to || null
  if (formData.notes != null) update.notes = formData.notes?.trim() || null
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('compensation_structures').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/payroll')
  return { success: true }
}

export async function deleteCompensationStructure(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('compensation_structures').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/payroll')
  return { success: true }
}

// Per-completed tiers
export async function createPerCompletedTier(formData: {
  personnel_id: string
  base_completed: number
  base_amount: number
  per_completed_amount: number
  effective_from: string
  effective_to?: string
  notes?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('compensation_per_completed').insert({
    personnel_id: formData.personnel_id,
    base_completed: formData.base_completed,
    base_amount: formData.base_amount,
    per_completed_amount: formData.per_completed_amount,
    effective_from: formData.effective_from,
    effective_to: formData.effective_to || null,
    notes: formData.notes?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/payroll')
  return { success: true }
}

export async function updatePerCompletedTier(
  id: string,
  formData: { base_completed?: number; base_amount?: number; per_completed_amount?: number; effective_to?: string; notes?: string }
) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.base_completed != null) update.base_completed = formData.base_completed
  if (formData.base_amount != null) update.base_amount = formData.base_amount
  if (formData.per_completed_amount != null) update.per_completed_amount = formData.per_completed_amount
  if (formData.effective_to != null) update.effective_to = formData.effective_to || null
  if (formData.notes != null) update.notes = formData.notes?.trim() || null
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('compensation_per_completed').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/payroll')
  return { success: true }
}

export async function deletePerCompletedTier(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('compensation_per_completed').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/payroll')
  return { success: true }
}

// Payment records - amount = HEDEF NET (Gross bu net'ten hesaplanır)
export async function createPaymentRecord(formData: {
  personnel_id: string
  amount: number  // Target Net (CAD)
  payment_type?: string
  period_start?: string
  period_end?: string
  completed_count?: number
  status?: string
  notes?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }

  const targetNet = formData.amount
  const gross = calculateGrossFromNet(targetNet)
  const deductions = calculateDeductions(gross)
  const deductionMetadata = {
    gross,
    cpp: Math.round(deductions.cpp * 100) / 100,
    ei: Math.round(deductions.ei * 100) / 100,
    federal_tax: Math.round(deductions.federalTax * 100) / 100,
    provincial_tax: Math.round(deductions.provincialTax * 100) / 100,
    net: Math.round(deductions.net * 100) / 100,
  }

  const { error } = await supabase.from('payment_records').insert({
    personnel_id: formData.personnel_id,
    amount: deductionMetadata.net,
    payment_type: formData.payment_type || null,
    period_start: formData.period_start || null,
    period_end: formData.period_end || null,
    completed_count: formData.completed_count ?? null,
    deduction_metadata: deductionMetadata,
    status: formData.status || 'pending',
    notes: formData.notes?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/payroll')
  return { success: true }
}

export async function createPaymentRecordFromPerCompleted(formData: {
  personnel_id: string
  period_start: string
  period_end: string
  tier_id: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }

  const { count } = await getCompletedCountForPeriod(
    formData.personnel_id,
    formData.period_start,
    formData.period_end
  )
  const { data: tier } = await supabase
    .from('compensation_per_completed')
    .select('*')
    .eq('id', formData.tier_id)
    .single()
  if (!tier) return { error: 'Tier not found' }

  const baseCompleted = Number(tier.base_completed)
  const baseNetAmount = Number(tier.base_amount)   // NET
  const perCompletedNetAmount = Number(tier.per_completed_amount)  // NET per each
  const targetNet = calculatePerCompletedAmount(baseCompleted, baseNetAmount, perCompletedNetAmount, count)
  const gross = calculateGrossFromNet(targetNet)

  const deductions = calculateDeductions(gross)
  const deductionMetadata = {
    gross,
    cpp: Math.round(deductions.cpp * 100) / 100,
    ei: Math.round(deductions.ei * 100) / 100,
    federal_tax: Math.round(deductions.federalTax * 100) / 100,
    provincial_tax: Math.round(deductions.provincialTax * 100) / 100,
    net: Math.round(deductions.net * 100) / 100,
    completed_count: count,
    base_completed: baseCompleted,
    base_amount: baseNetAmount,
    per_completed_amount: perCompletedNetAmount,
  }

  const { error } = await supabase.from('payment_records').insert({
    personnel_id: formData.personnel_id,
    amount: deductionMetadata.net,
    payment_type: 'per_completed_tiered',
    period_start: formData.period_start,
    period_end: formData.period_end,
    completed_count: count,
    deduction_metadata: deductionMetadata,
    status: 'pending',
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/payroll')
  return { success: true }
}

export async function updatePaymentRecord(
  id: string,
  formData: { status?: string; paid_at?: string; notes?: string }
) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.status != null) update.status = formData.status
  if (formData.paid_at != null) update.paid_at = formData.paid_at || null
  if (formData.notes != null) update.notes = formData.notes?.trim() || null
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('payment_records').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/payroll')
  return { success: true }
}

export async function deletePaymentRecord(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('payment_records').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/payroll')
  return { success: true }
}

// Pay stub: Gross girişinden
export async function calculatePayStub(gross: number) {
  const d = calculateDeductions(gross)
  return {
    gross: Math.round(gross * 100) / 100,
    cpp: Math.round(d.cpp * 100) / 100,
    ei: Math.round(d.ei * 100) / 100,
    federal_tax: Math.round(d.federalTax * 100) / 100,
    provincial_tax: Math.round(d.provincialTax * 100) / 100,
    total_deductions: Math.round(d.totalDeductions * 100) / 100,
    net: Math.round(d.net * 100) / 100,
  }
}

// Pay stub: from Net input (Gross calculated)
export async function calculatePayStubFromNet(targetNet: number) {
  const gross = calculateGrossFromNet(targetNet)
  return calculatePayStub(gross)
}
