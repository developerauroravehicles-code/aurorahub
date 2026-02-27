'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface SmsLogEntry {
  id: string
  sent_at: string
  phone_number: string
  recipient_type: string
  recipient_name: string | null
  demand_id: string | null
  message_type: string
  triggered_by: string
  message_content: string | null
}

export interface DemandLogEntry {
  id: string
  demand_id: string
  demand_number: string | null
  customer_name: string | null
  actor_id: string | null
  previous_status: string | null
  new_status: string
  notes: string | null
  created_at: string
  actor_name: string | null
}

export interface MailLogEntry {
  id: string
  sent_at: string
  recipient_emails: string[]
  subject: string
  mail_type: string
  report_title: string | null
  sender_name: string | null
  success: boolean
  error_message: string | null
}

export async function getSmsLogsForLogsPage(filters?: {
  dateFrom?: string
  dateTo?: string
  customerName?: string
}): Promise<{ error?: string; logs?: SmsLogEntry[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') return { error: 'Only Aurora Managers can view SMS logs' }

  let query = supabase
    .from('sms_logs')
    .select('id, sent_at, phone_number, recipient_type, recipient_name, demand_id, message_type, triggered_by, message_content')
    .order('sent_at', { ascending: false })
    .limit(200)

  if (filters?.dateFrom) {
    query = query.gte('sent_at', `${filters.dateFrom}T00:00:00.000Z`)
  }
  if (filters?.dateTo) {
    query = query.lte('sent_at', `${filters.dateTo}T23:59:59.999Z`)
  }
  if (filters?.customerName?.trim()) {
    const term = filters.customerName.trim().toLowerCase()
    query = query.ilike('recipient_name', `%${term}%`)
  }

  const { data, error } = await query
  if (error) return { error: error.message }
  return { logs: (data ?? []) as SmsLogEntry[] }
}

export async function getDemandLogsForLogsPage(filters?: {
  dateFrom?: string
  dateTo?: string
  demandId?: string
  actorId?: string
}): Promise<{ error?: string; logs?: DemandLogEntry[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') return { error: 'Only Aurora Managers can view demand logs' }

  // Use admin client to bypass RLS (auth already verified above)
  const admin = createAdminClient()
  let query = admin
    .from('demand_logs')
    .select('id, demand_id, actor_id, previous_status, new_status, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (filters?.dateFrom) {
    query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`)
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`)
  }
  if (filters?.demandId?.trim()) {
    query = query.eq('demand_id', filters.demandId.trim())
  }
  if (filters?.actorId?.trim()) {
    query = query.eq('actor_id', filters.actorId.trim())
  }

  const { data: rows, error } = await query
  if (error) return { error: error.message }

  const demandIds = [...new Set((rows ?? []).map((r: { demand_id?: string }) => r.demand_id).filter(Boolean))]
  let demandNumbers: Record<string, string> = {}
  let customerNames: Record<string, string> = {}
  if (demandIds.length > 0) {
    const { data: demands } = await admin
      .from('demands')
      .select('id, demand_number, customer_firstname, customer_lastname')
      .in('id', demandIds)
    ;(demands ?? []).forEach((d) => {
      if (d.demand_number) demandNumbers[d.id] = d.demand_number
      const name = [d.customer_firstname, d.customer_lastname].filter(Boolean).join(' ').trim()
      if (name) customerNames[d.id] = name
    })
  }

  const actorIds = [...new Set((rows ?? []).map((r: { actor_id?: string }) => r.actor_id).filter(Boolean))]
  let actorNames: Record<string, string> = {}
  if (actorIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', actorIds)
    actorNames = (profiles ?? []).reduce((acc, p) => {
      acc[p.id] = p.full_name ?? '—'
      return acc
    }, {} as Record<string, string>)
  }

  const logs = (rows ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    demand_id: row.demand_id,
    demand_number: row.demand_id ? demandNumbers[row.demand_id as string] ?? null : null,
    customer_name: row.demand_id ? customerNames[row.demand_id as string] ?? null : null,
    actor_id: row.actor_id,
    previous_status: row.previous_status,
    new_status: row.new_status,
    notes: row.notes,
    created_at: row.created_at,
    actor_name: row.actor_id ? actorNames[row.actor_id as string] ?? null : null,
  })) as DemandLogEntry[]

  return { logs }
}

export async function getMailLogsForLogsPage(filters?: {
  dateFrom?: string
  dateTo?: string
  mailType?: string
  recipientEmail?: string
}): Promise<{ error?: string; logs?: MailLogEntry[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') return { error: 'Only Aurora Managers can view mail logs' }

  let query = supabase
    .from('mail_logs')
    .select('id, sent_at, recipient_emails, subject, mail_type, report_title, sender_id, success, error_message')
    .order('sent_at', { ascending: false })
    .limit(200)

  if (filters?.dateFrom) {
    query = query.gte('sent_at', `${filters.dateFrom}T00:00:00.000Z`)
  }
  if (filters?.dateTo) {
    query = query.lte('sent_at', `${filters.dateTo}T23:59:59.999Z`)
  }
  if (filters?.mailType?.trim()) {
    query = query.eq('mail_type', filters.mailType.trim())
  }
  const { data: rows, error } = await query

  if (error) return { error: error.message }

  let filteredRows = rows ?? []
  if (filters?.recipientEmail?.trim()) {
    const term = filters.recipientEmail.trim().toLowerCase()
    filteredRows = filteredRows.filter((r: { recipient_emails?: string[] }) =>
      (r.recipient_emails ?? []).some((e) => e.toLowerCase().includes(term))
    )
  }

  const senderIds = [...new Set(filteredRows.map((r: { sender_id?: string }) => r.sender_id).filter(Boolean))]
  let senderNames: Record<string, string> = {}
  if (senderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', senderIds)
    senderNames = (profiles ?? []).reduce((acc, p) => {
      acc[p.id] = p.full_name ?? '—'
      return acc
    }, {} as Record<string, string>)
  }

  const logs = filteredRows.map((row: Record<string, unknown>) => ({
    id: row.id,
    sent_at: row.sent_at,
    recipient_emails: (row.recipient_emails as string[]) ?? [],
    subject: row.subject,
    mail_type: row.mail_type,
    report_title: row.report_title,
    sender_name: row.sender_id ? senderNames[row.sender_id as string] ?? '—' : null,
    success: row.success,
    error_message: row.error_message,
  })) as MailLogEntry[]

  return { logs }
}
