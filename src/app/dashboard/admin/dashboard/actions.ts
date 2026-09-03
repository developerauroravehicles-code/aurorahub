'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getTodayRangeInTimezone, getEffectiveTimezone, getMonthRangeInTimezone, SYSTEM_DEFAULT_TIMEZONE, ptDatetimeLocalToISO } from '@/lib/timezone-defaults'

export type ManagerNote = {
  id: string
  created_by: string
  content: string
  reminder_at: string | null
  is_done: boolean
  created_at: string
  updated_at: string
}

export async function getManagerNotes(): Promise<{ notes: ManagerNote[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { notes: [], error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { notes: [], error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('manager_notes')
    .select('id, created_by, content, reminder_at, is_done, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { notes: [], error: error.message }
  return { notes: (data ?? []) as ManagerNote[] }
}

export async function createManagerNote(
  content: string,
  reminderAt?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Unauthorized' }
  }

  const reminderIso =
    reminderAt?.trim()
      ? ptDatetimeLocalToISO(reminderAt.trim())
      : null

  const { error } = await supabase
    .from('manager_notes')
    .insert({
      created_by: user.id,
      content: content.trim(),
      reminder_at: reminderIso
    })

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return {}
}

export async function updateManagerNote(
  id: string,
  updates: { content?: string; reminder_at?: string | null; is_done?: boolean }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Unauthorized' }
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.content !== undefined) payload.content = updates.content.trim()
  if (updates.reminder_at !== undefined) {
    payload.reminder_at = updates.reminder_at?.trim() ? ptDatetimeLocalToISO(updates.reminder_at.trim()) : null
  }
  if (updates.is_done !== undefined) payload.is_done = updates.is_done

  const { error } = await supabase
    .from('manager_notes')
    .update(payload)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return {}
}

export async function deleteManagerNote(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('manager_notes')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return {}
}

export type DealerAlert = {
  type: 'overdue' | 'pending_finance' | 'incomplete_invoice'
  dealerId: string
  dealerName: string
  count: number
  demandId?: string
  demandNumber?: string
}

export async function getDealerAlerts(): Promise<{ alerts: DealerAlert[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { alerts: [], error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { alerts: [], error: 'Unauthorized' }
  }

  const alerts: DealerAlert[] = []

  const { data: dealers } = await supabase
    .from('dealers')
    .select('id, name, region_codes(timezone_id, timezones(name))')
    .order('name')

  if (!dealers?.length) return { alerts: [] }

  for (const dealer of dealers) {
    const tz = getEffectiveTimezone((dealer.region_codes as { timezones?: { name: string } } | null)?.timezones?.name ?? null)
    const { start: rangeStart } = getTodayRangeInTimezone(tz)

    const { data: overdue } = await supabase
      .from('demands')
      .select('id, demand_number')
      .eq('dealer_id', dealer.id)
      .eq('status', 'approved')
      .lt('appointment_date', rangeStart)
      .limit(5)

    if (overdue?.length) {
      for (const d of overdue) {
        alerts.push({
          type: 'overdue',
          dealerId: dealer.id,
          dealerName: dealer.name,
          count: 1,
          demandId: d.id,
          demandNumber: (d as { demand_number?: string }).demand_number
        })
      }
    }

    const { count: pendingCount } = await supabase
      .from('demands')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', dealer.id)
      .eq('status', 'pending_finance')

    if ((pendingCount ?? 0) > 0) {
      alerts.push({
        type: 'pending_finance',
        dealerId: dealer.id,
        dealerName: dealer.name,
        count: pendingCount ?? 0
      })
    }

    const { count: incompleteCount } = await supabase
      .from('demands')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', dealer.id)
      .eq('status', 'completed')
      .is('invoice_drive_uploaded_at', null)

    if ((incompleteCount ?? 0) > 0) {
      alerts.push({
        type: 'incomplete_invoice',
        dealerId: dealer.id,
        dealerName: dealer.name,
        count: incompleteCount ?? 0
      })
    }
  }

  return { alerts }
}

// Dashboard overview data for Aurora Manager
export type DemandCounts = {
  pending_finance: number
  approved: number
  completed: number
  cancelled: number
}

export type InvoiceSummary = {
  waiting: number
  edited: number
  downloaded: number
  drive: number
  incompleteList: { id: string; demand_number: string | null; dealerName: string }[]
}

export type StatementSummary = {
  dealersWithRecentCompleted: number
  totalCompletedLast30Days: number
}

export type EmployeeRoleCounts = {
  sales: number
  finance: number
  specialist: number
  aurora_manager: number
}

export type MonthlyDemandTrend = { month: string; demands: number; completed: number }[]
export type DealerDemandCount = { dealerName: string; total: number; completed: number }[]

export type FinanceSummary = {
  totalInvoiced: number
  totalTax: number
  totalSubtotal: number
  invoiceCount: number
  byDealer: { dealerName: string; total: number; tax: number; count: number }[]
}

export async function getDashboardOverviewData(financeMonth?: string | null): Promise<{
  demandCounts: DemandCounts
  invoiceSummary: InvoiceSummary
  statementSummary: StatementSummary
  employeeRoleCounts: EmployeeRoleCounts
  monthlyTrend: MonthlyDemandTrend
  dealerDemands: DealerDemandCount
  financeSummary: FinanceSummary
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const emptyFinance: FinanceSummary = {
    totalInvoiced: 0,
    totalTax: 0,
    totalSubtotal: 0,
    invoiceCount: 0,
    byDealer: []
  }
  const empty = {
    demandCounts: { pending_finance: 0, approved: 0, completed: 0, cancelled: 0 },
    invoiceSummary: { waiting: 0, edited: 0, downloaded: 0, drive: 0, incompleteList: [] },
    statementSummary: { dealersWithRecentCompleted: 0, totalCompletedLast30Days: 0 },
    employeeRoleCounts: { sales: 0, finance: 0, specialist: 0, aurora_manager: 0 },
    monthlyTrend: [] as MonthlyDemandTrend,
    dealerDemands: [] as DealerDemandCount,
    financeSummary: emptyFinance
  }
  if (!user) return { ...empty, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    return { ...empty, error: 'Unauthorized' }
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const from30 = thirtyDaysAgo.toISOString()

  const [{ data: demands }, { data: employees }] = await Promise.all([
    supabase
      .from('demands')
      .select(
        'id, status, demand_number, dealer_id, created_at, completed_at, updated_at, invoice_saved_at, invoice_downloaded_at, invoice_drive_uploaded_at, invoice_total_amount, invoice_financial_summary, dealers(name)'
      ),
    supabase.from('profiles').select('role').neq('role', 'general_manager'),
  ])
  const demandsList = demands ?? []

  const demandCounts: DemandCounts = {
    pending_finance: demandsList.filter(d => d.status === 'pending_finance').length,
    approved: demandsList.filter(d => d.status === 'approved').length,
    completed: demandsList.filter(d => d.status === 'completed').length,
    cancelled: demandsList.filter(d => d.status === 'cancelled').length
  }

  const completedDemands = demandsList.filter(d => d.status === 'completed')
  let waiting = 0
  let edited = 0
  let downloaded = 0
  let drive = 0
  const incompleteList: InvoiceSummary['incompleteList'] = []

  for (const d of completedDemands) {
    const hasDrive = !!d.invoice_drive_uploaded_at
    const hasDownloaded = !!d.invoice_downloaded_at
    const hasSaved = !!(d.invoice_saved_at ?? d.invoice_total_amount)

    if (hasDrive) drive++
    else if (hasDownloaded) downloaded++
    else if (hasSaved) edited++
    else waiting++

    if (!hasDrive) {
      const dealer = d.dealers as { name?: string } | { name?: string }[] | null
      const dealerName = (Array.isArray(dealer) ? dealer[0]?.name : dealer?.name) ?? 'Unknown'
      incompleteList.push({
        id: d.id,
        demand_number: (d as { demand_number?: number }).demand_number?.toString() ?? null,
        dealerName
      })
    }
  }

  const recentCompleted = completedDemands.filter(d => {
    const completedAt = (d as { completed_at?: string }).completed_at ?? (d as { updated_at?: string }).updated_at
    return completedAt && new Date(completedAt) >= thirtyDaysAgo
  })
  const dealerIds = new Set(recentCompleted.map(d => d.dealer_id))

  const employeeRoleCounts: EmployeeRoleCounts = {
    sales: employees?.filter(e => e.role === 'sales').length ?? 0,
    finance: employees?.filter(e => e.role === 'finance').length ?? 0,
    specialist: employees?.filter(e => e.role === 'specialist').length ?? 0,
    aurora_manager: employees?.filter(e => e.role === 'aurora_manager').length ?? 0
  }

  // Monthly demand trend (last 6 months)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const now = new Date()
  const monthlyTrend: MonthlyDemandTrend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = d.toISOString()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
    const inMonth = demandsList.filter(dd => {
      const created = (dd as { created_at?: string }).created_at
      return created && created >= start && created <= end
    })
    const completedInMonth = inMonth.filter(dd => dd.status === 'completed')
    monthlyTrend.push({
      month: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      demands: inMonth.length,
      completed: completedInMonth.length
    })
  }

  // Dealer demand counts (top 8 dealers)
  const dealerMap = new Map<string, { total: number; completed: number }>()
  for (const d of demandsList) {
    const dealer = d.dealers as { name?: string } | { name?: string }[] | null
    const name = (Array.isArray(dealer) ? dealer[0]?.name : dealer?.name) ?? 'Unknown'
    const cur = dealerMap.get(name) ?? { total: 0, completed: 0 }
    cur.total++
    if (d.status === 'completed') cur.completed++
    dealerMap.set(name, cur)
  }
  const dealerDemands: DealerDemandCount = Array.from(dealerMap.entries())
    .map(([dealerName, v]) => ({ dealerName, total: v.total, completed: v.completed }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  // Finance summary: completed demands with invoice amounts (optionally filtered by month)
  let financeDemands = completedDemands
  if (financeMonth && /^\d{4}-\d{2}$/.test(financeMonth)) {
    const { start, end } = getMonthRangeInTimezone(financeMonth, SYSTEM_DEFAULT_TIMEZONE)
    financeDemands = completedDemands.filter(d => {
      const completedAt = (d as { completed_at?: string }).completed_at ?? (d as { updated_at?: string }).updated_at
      return completedAt && completedAt >= start && completedAt <= end
    })
  }

  const defaultFs = { gstEnabled: true, gstPercent: 5, pstEnabled: false, pstPercent: 7, salesTaxEnabled: false, salesTaxPercent: 0, otherEnabled: false, otherAmount: 0 }
  let totalInvoiced = 0
  let totalTax = 0
  let totalSubtotal = 0
  const dealerFinanceMap = new Map<string, { total: number; tax: number; count: number }>()
  for (const d of financeDemands) {
    const amount = d.invoice_total_amount ?? 0
    if (amount <= 0) continue

    const fs = (d.invoice_financial_summary && typeof d.invoice_financial_summary === 'object'
      ? { ...defaultFs, ...d.invoice_financial_summary }
      : defaultFs) as { gstEnabled: boolean; gstPercent: number; pstEnabled: boolean; pstPercent: number; salesTaxEnabled: boolean; salesTaxPercent: number; otherEnabled: boolean; otherAmount: number }

    const extraRows = Array.isArray(d.invoice_extra_rows) && d.invoice_extra_rows.length > 0
      ? d.invoice_extra_rows
      : []
    const col2Sum = extraRows.reduce((sum, r) => sum + (parseFloat(String(r?.col2 || '0').replace(/[^0-9.-]/g, '')) || 0), 0)
    const other = fs.otherEnabled ? (fs.otherAmount ?? 0) : 0
    const taxRatePct = (fs.gstEnabled ? fs.gstPercent : 0) + (fs.pstEnabled ? fs.pstPercent : 0) + (fs.salesTaxEnabled ? fs.salesTaxPercent : 0)
    const subtotal = col2Sum > 0
      ? col2Sum
      : (amount > 0 && taxRatePct < 100 ? (amount - other) / (1 + taxRatePct / 100) : Math.max(0, amount - other))
    const gst = fs.gstEnabled ? subtotal * (fs.gstPercent / 100) : 0
    const pst = fs.pstEnabled ? subtotal * (fs.pstPercent / 100) : 0
    const salesTax = fs.salesTaxEnabled ? subtotal * (fs.salesTaxPercent / 100) : 0
    const tax = gst + pst + salesTax

    totalInvoiced += amount
    totalTax += tax
    totalSubtotal += subtotal

    const dealer = d.dealers as { name?: string } | { name?: string }[] | null
    const dealerName = (Array.isArray(dealer) ? dealer[0]?.name : dealer?.name) ?? 'Unknown'
    const cur = dealerFinanceMap.get(dealerName) ?? { total: 0, tax: 0, count: 0 }
    cur.total += amount
    cur.tax += tax
    cur.count++
    dealerFinanceMap.set(dealerName, cur)
  }

  const financeSummary: FinanceSummary = {
    totalInvoiced,
    totalTax,
    totalSubtotal,
    invoiceCount: financeDemands.filter(d => (d.invoice_total_amount ?? 0) > 0).length,
    byDealer: Array.from(dealerFinanceMap.entries())
      .map(([dealerName, v]) => ({ dealerName, total: v.total, tax: v.tax, count: v.count }))
      .sort((a, b) => b.total - a.total)
  }

  return {
    demandCounts,
    invoiceSummary: { waiting, edited, downloaded, drive, incompleteList: incompleteList.slice(0, 10) },
    statementSummary: { dealersWithRecentCompleted: dealerIds.size, totalCompletedLast30Days: recentCompleted.length },
    employeeRoleCounts,
    monthlyTrend,
    dealerDemands,
    financeSummary
  }
}
