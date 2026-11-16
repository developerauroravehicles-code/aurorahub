import type { SupabaseClient } from '@supabase/supabase-js'
import {
  aggregateDealerSales,
  filterDemandsInPeriod,
  type CompletedDemandSalesRow,
  topDealersBySales,
  activeDealerCount,
} from '@/lib/crm/dealer-sales'
import { aggregateAcquirerSales } from '@/lib/crm/acquirer-sales'
import { crmPeriodIsoBounds, type CrmPeriod } from '@/lib/crm/period'

export type CrmDealerRow = {
  id: string
  code: string
  name: string
  address: string | null
  phone: string | null
  crm_summary: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  acquired_by_profile_id: string | null
  acquired_at: string | null
  region_codes?: { name: string; code: string } | { name: string; code: string }[] | null
  acquired_by?: { full_name: string | null } | null
}

export async function fetchCompletedDemandSales(
  supabase: SupabaseClient
): Promise<CompletedDemandSalesRow[]> {
  const { data, error } = await supabase
    .from('demands')
    .select('dealer_id, invoice_total_amount, completed_at, updated_at')
    .eq('status', 'completed')
    .not('dealer_id', 'is', null)

  if (error) throw new Error(error.message)
  return (data ?? []) as CompletedDemandSalesRow[]
}

export async function buildCrmSnapshot(
  supabase: SupabaseClient,
  period: CrmPeriod
) {
  const { startIso, endIso } = crmPeriodIsoBounds(period)
  const allRows = await fetchCompletedDemandSales(supabase)
  const periodRows = filterDemandsInPeriod(allRows, startIso, endIso)
  const sales = aggregateDealerSales(periodRows)

  const { data: dealers, error: dealerErr } = await supabase
    .from('dealers')
    .select(
      'id, code, name, address, phone, crm_summary, primary_contact_name, primary_contact_email, acquired_by_profile_id, acquired_at, region_codes(name, code)'
    )
    .order('name')

  if (dealerErr) throw new Error(dealerErr.message)

  let dealerRows = (dealers ?? []) as unknown as CrmDealerRow[]

  const acquirerIds = [
    ...new Set(dealerRows.map((d) => d.acquired_by_profile_id).filter(Boolean)),
  ] as string[]
  if (acquirerIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', acquirerIds)
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))
    dealerRows = dealerRows.map((d) => ({
      ...d,
      acquired_by: d.acquired_by_profile_id
        ? { full_name: nameById.get(d.acquired_by_profile_id) ?? null }
        : null,
    }))
  }
  const acquirer = aggregateAcquirerSales(
    dealerRows.map((d) => ({
      dealerId: d.id,
      acquiredByProfileId: d.acquired_by_profile_id,
    })),
    sales.byDealer
  )

  return {
    period,
    sales,
    dealers: dealerRows,
    acquirer,
    totalRegisteredDealers: dealerRows.length,
    activeDealers: activeDealerCount(sales.byDealer),
    topDealers: topDealersBySales(sales.byDealer, 5),
  }
}

export async function fetchDealerCrmDetail(supabase: SupabaseClient, dealerId: string) {
  const { data: dealer, error } = await supabase
    .from('dealers')
    .select(
      'id, code, name, address, phone, crm_summary, primary_contact_name, primary_contact_email, acquired_by_profile_id, acquired_at, region_codes(name, code)'
    )
    .eq('id', dealerId)
    .single()

  if (error || !dealer) return null

  let acquired_by_name: string | null = null
  if (dealer.acquired_by_profile_id) {
    const { data: p } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', dealer.acquired_by_profile_id)
      .maybeSingle()
    acquired_by_name = p?.full_name ?? null
  }

  const { data: invoiceEmails } = await supabase
    .from('dealer_invoice_emails')
    .select('email')
    .eq('dealer_id', dealerId)

  const { data: notes } = await supabase
    .from('dealer_crm_notes')
    .select('id, body, meeting_at, created_at, created_by')
    .eq('dealer_id', dealerId)
    .order('created_at', { ascending: false })

  const noteIds = (notes ?? []).map((n) => n.id)
  let reminders: {
    id: string
    note_id: string
    remind_on: string
    remind_at: string | null
    follow_up_kind: string | null
    recipient_email: string
    subject: string
    status: string
    sent_at: string | null
    last_error: string | null
  }[] = []

  if (noteIds.length > 0) {
    const { data: rem } = await supabase
      .from('dealer_crm_note_reminders')
      .select('id, note_id, remind_on, remind_at, follow_up_kind, recipient_email, subject, status, sent_at, last_error')
      .in('note_id', noteIds)
    reminders = rem ?? []
  }

  const authorIds = [...new Set((notes ?? []).map((n) => n.created_by))]
  const { data: authors } = authorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', authorIds)
    : { data: [] }
  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]))

  const emailSuggestions = [
    ...new Set(
      [dealer.primary_contact_email, ...(invoiceEmails ?? []).map((e) => e.email)].filter(
      (e): e is string => !!e && e.includes('@')
    )
    ),
  ]

  const noteRows = (notes ?? []).map((n) => ({
    id: n.id,
    body: n.body,
    meeting_at: n.meeting_at as string | null,
    created_at: n.created_at,
    author: { full_name: authorMap.get(n.created_by)?.full_name ?? null },
    reminders: reminders.filter((r) => r.note_id === n.id),
  }))

  return {
    dealer: {
      ...dealer,
      acquired_by_name,
    },
    notes: noteRows,
    emailSuggestions,
  }
}

export function salesStatForDealer(
  dealerId: string,
  byDealer: { dealerId: string; completedCount: number; salesTotal: number; sharePercent: number }[]
) {
  return (
    byDealer.find((d) => d.dealerId === dealerId) ?? {
      dealerId,
      completedCount: 0,
      salesTotal: 0,
      sharePercent: 0,
    }
  )
}