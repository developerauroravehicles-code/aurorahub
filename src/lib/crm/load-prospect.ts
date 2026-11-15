import type { SupabaseClient } from '@supabase/supabase-js'

export type CrmProspectRow = {
  id: string
  name: string
  primary_contact_name: string | null
  primary_contact_email: string | null
  phone: string | null
  address: string | null
  status: string
  dealer_id: string | null
  acquired_by_profile_id: string | null
  acquired_at: string | null
  created_at: string
  updated_at: string
  acquired_by_name?: string | null
  last_note_at?: string | null
}

export async function listCrmProspects(supabase: SupabaseClient): Promise<CrmProspectRow[]> {
  const { data, error } = await supabase
    .from('crm_prospects')
    .select(
      'id, name, primary_contact_name, primary_contact_email, phone, address, status, dealer_id, acquired_by_profile_id, acquired_at, created_at, updated_at'
    )
    .in('status', ['prospect', 'qualified'])
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  const rows = data ?? []

  const { data: noteAgg } = await supabase
    .from('dealer_crm_notes')
    .select('prospect_id, created_at')
    .not('prospect_id', 'is', null)
    .order('created_at', { ascending: false })

  const lastByProspect = new Map<string, string>()
  for (const n of noteAgg ?? []) {
    const pid = n.prospect_id as string
    if (!lastByProspect.has(pid)) lastByProspect.set(pid, n.created_at as string)
  }

  return rows.map((r) => ({
    ...r,
    last_note_at: lastByProspect.get(r.id) ?? null,
  }))
}

export async function fetchProspectCrmDetail(supabase: SupabaseClient, prospectId: string) {
  const { data: prospect, error } = await supabase
    .from('crm_prospects')
    .select(
      'id, name, primary_contact_name, primary_contact_email, phone, address, status, dealer_id, acquired_by_profile_id, acquired_at, created_at, updated_at'
    )
    .eq('id', prospectId)
    .single()

  if (error || !prospect) return null

  let acquired_by_name: string | null = null
  if (prospect.acquired_by_profile_id) {
    const { data: p } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', prospect.acquired_by_profile_id)
      .maybeSingle()
    acquired_by_name = p?.full_name ?? null
  }

  const { data: notes } = await supabase
    .from('dealer_crm_notes')
    .select('id, body, meeting_at, created_at, created_by')
    .eq('prospect_id', prospectId)
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

  const emailSuggestions = [prospect.primary_contact_email].filter(
    (e): e is string => !!e && e.includes('@')
  )

  const noteRows = (notes ?? []).map((n) => ({
    id: n.id,
    body: n.body,
    meeting_at: n.meeting_at as string | null,
    created_at: n.created_at,
    author: { full_name: authorMap.get(n.created_by)?.full_name ?? null },
    reminders: reminders.filter((r) => r.note_id === n.id),
  }))

  return {
    prospect: { ...prospect, acquired_by_name },
    notes: noteRows,
    emailSuggestions,
  }
}