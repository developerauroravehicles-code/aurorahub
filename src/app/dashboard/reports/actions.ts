'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReportEmail as sendEmail } from '@/lib/email'
import type { ExportReportOptions } from '@/lib/export-report-pdf'

export interface ReportRecipient {
  id: string
  full_name: string | null
  email: string
  role: string
}

export async function getReportRecipients(): Promise<
  { recipients: ReportRecipient[]; error?: string } | { recipients: null; error: string }
> {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { recipients: null, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, dealer_id')
    .eq('id', user.id)
    .single()

  if (!profile) return { recipients: null, error: 'Profile not found' }

  let profileIds: string[] = []
  const role = profile.role
  const dealerId = profile.dealer_id

  if (role === 'sales' || role === 'finance' || role === 'general_manager') {
    if (!dealerId) return { recipients: [] }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('dealer_id', dealerId)
      .neq('id', user.id)
      .in('role', ['sales', 'finance', 'general_manager'])
    profileIds = profiles?.map((p) => p.id) ?? []
  } else if (role === 'specialist') {
    const { data: specialistDealers } = await supabase
      .from('specialist_dealers')
      .select('dealer_id')
      .eq('specialist_id', user.id)

    const dealerIds: string[] =
      (specialistDealers?.length ?? 0) > 0
        ? specialistDealers!.map((sd: { dealer_id: string }) => sd.dealer_id)
        : dealerId
          ? [dealerId]
          : []

    if (dealerIds.length === 0) return { recipients: [] }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('dealer_id', dealerIds)
      .neq('id', user.id)
      .in('role', ['sales', 'finance', 'specialist', 'general_manager'])
    profileIds = profiles?.map((p) => p.id) ?? []
  } else if (role === 'aurora_manager') {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .neq('id', user.id)
      .in('role', ['sales', 'finance', 'specialist', 'general_manager'])
    profileIds = profiles?.map((p) => p.id) ?? []
  } else {
    return { recipients: [] }
  }

  const recipients: ReportRecipient[] = []
  for (const pid of profileIds) {
    const { data: p } = await supabase.from('profiles').select('full_name, role').eq('id', pid).single()
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(pid)
    const email = authUser?.user?.email
    if (email && p) {
      recipients.push({
        id: pid,
        full_name: p.full_name ?? null,
        email,
        role: p.role ?? 'unknown',
      })
    }
  }

  return { recipients }
}

export async function getAuroraManagerRecipients(): Promise<ReportRecipient[]> {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'aurora_manager')

  const recipients: ReportRecipient[] = []
  for (const p of profiles ?? []) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id)
    const email = authUser?.user?.email
    if (email) {
      recipients.push({
        id: p.id,
        full_name: p.full_name ?? null,
        email,
        role: 'aurora_manager',
      })
    }
  }
  return recipients
}

export interface SendReportEmailParams {
  recipientIds: string[]
  includeAuroraManager: boolean
  reportTitle: string
  dateRange: string
  exporterFullName: string
  pdfBase64: string
  optionalMessage?: string
}

export async function sendReportEmailAction(
  params: SendReportEmailParams
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const {
    recipientIds,
    includeAuroraManager,
    reportTitle,
    dateRange,
    exporterFullName,
    pdfBase64,
    optionalMessage,
  } = params

  const toEmails: string[] = []

  for (const pid of recipientIds) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(pid)
    if (authUser?.user?.email) {
      toEmails.push(authUser.user.email)
    }
  }

  if (includeAuroraManager) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'aurora_manager')
    for (const p of profiles ?? []) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id)
      if (authUser?.user?.email && !toEmails.includes(authUser.user.email)) {
        toEmails.push(authUser.user.email)
      }
    }
  }

  if (toEmails.length === 0) {
    return { success: false, error: 'No valid recipients' }
  }

  return sendEmail({
    to: toEmails,
    subject: `${reportTitle} - ${dateRange}`,
    reportTitle,
    exporterFullName,
    dateRange,
    pdfBase64,
    optionalMessage,
  })
}
