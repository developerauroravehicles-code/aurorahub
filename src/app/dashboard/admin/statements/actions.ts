'use server'

import { createClient } from '@/lib/supabase/server'
import { getDateRangeInTimezone, SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { buildStatementPdf, getStatementPdfBase64 } from '@/lib/generate-statement-pdf'
import { uploadStatementToDrive, type GoogleDriveSettings } from '@/lib/google-drive'
import type { StatementPdfData } from '@/lib/generate-statement-pdf'
import { sendDocumentPdfEmail, parseEmailRecipients, buildStatementInvoicesEmailHtml } from '@/lib/email'

export interface DealerOption {
  id: string
  name: string
}

export interface StatementDemandRow {
  id: string
  demand_number: string | null
  updated_at: string
  completed_at: string | null
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  stock_number: string | null
  vin_last6: string | null
  invoice_total_amount: number | null
  dealers: { name: string } | { name: string }[] | null
}

function getDealerName(d: StatementDemandRow): string {
  const dealers = d.dealers
  if (!dealers) return 'Unknown Dealer'
  const single = Array.isArray(dealers) ? dealers[0] : dealers
  return (single as { name: string })?.name ?? 'Unknown Dealer'
}

export async function getDealersForStatementAction(): Promise<{
  error?: string
  dealers?: DealerOption[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Managers can view statements' }
  }

  const { data: dealers, error } = await supabase
    .from('dealers')
    .select('id, name')
    .order('name')

  if (error) return { error: error.message }
  return { dealers: dealers ?? [] }
}

export async function getStatementDataAction(
  dealerId: string | null,
  dateFrom: string,
  dateTo: string
): Promise<{ error?: string; rows?: StatementDemandRow[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role, dealer_id').eq('id', user.id).single()
  const isGM = profile?.role === 'general_manager'
  const isAuroraManager = profile?.role === 'aurora_manager'
  if (!profile || (!isAuroraManager && !isGM)) {
    return { error: 'Unauthorized' }
  }

  const effectiveDealerId = isGM && profile.dealer_id ? profile.dealer_id : dealerId

  let query = supabase
    .from('demands')
    .select(`
      id,
      demand_number,
      updated_at,
      completed_at,
      vehicle_year,
      vehicle_make,
      vehicle_model,
      stock_number,
      vin_last6,
      invoice_total_amount,
      dealers(name)
    `)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .order('updated_at', { ascending: false })

  if (effectiveDealerId) {
    query = query.eq('dealer_id', effectiveDealerId)
  }
  if (dateFrom && dateTo) {
    const { start: from, end: to } = getDateRangeInTimezone(dateFrom, dateTo, SYSTEM_DEFAULT_TIMEZONE)
    query = query.or(
      `and(completed_at.gte.${from},completed_at.lte.${to}),and(completed_at.is.null,updated_at.gte.${from},updated_at.lte.${to})`
    )
  } else if (dateFrom) {
    const { start: from } = getDateRangeInTimezone(dateFrom, dateFrom, SYSTEM_DEFAULT_TIMEZONE)
    query = query.or(`completed_at.gte.${from},and(completed_at.is.null,updated_at.gte.${from})`)
  } else if (dateTo) {
    const { end: to } = getDateRangeInTimezone(dateTo, dateTo, SYSTEM_DEFAULT_TIMEZONE)
    query = query.or(`completed_at.lte.${to},and(completed_at.is.null,updated_at.lte.${to})`)
  }

  const { data: demands, error } = await query
  if (error) return { error: error.message }
  return { rows: demands ?? [] }
}

export async function uploadStatementToDriveAction(
  statementData: StatementPdfData
): Promise<{ success: true; fileId: string; webViewLink?: string } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { success: false, error: 'Only Aurora Manager can upload statements to Drive' }
  }

  const { data: settingsRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'google_drive_settings')
    .single()

  if (!settingsRow?.value) {
    return { success: false, error: 'Google Drive not configured. Configure in Integrations > External APIs.' }
  }

  const settings = JSON.parse(settingsRow.value) as GoogleDriveSettings
  if (!settings.enabled) {
    return { success: false, error: 'Google Drive integration is disabled' }
  }

  const doc = buildStatementPdf(statementData)
  const buffer = doc.output('arraybuffer') as ArrayBuffer
  const sanitizedDealer = statementData.dealerName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Statement'
  const fileName = `Statement_${sanitizedDealer}_${statementData.dateFrom}_${statementData.dateTo}.pdf`
  const pdfBuffer = Buffer.from(buffer)

  return uploadStatementToDrive(pdfBuffer, fileName, statementData.dealerName, statementData.dateFrom, settings)
}

export async function sendStatementPdfEmailAction(
  recipientsRaw: string,
  statementData: StatementPdfData
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAuroraManager = profile?.role === 'aurora_manager'
  const isGM = profile?.role === 'general_manager'
  if (!profile || (!isAuroraManager && !isGM)) {
    return { error: 'Unauthorized' }
  }

  const to = parseEmailRecipients(recipientsRaw)
  if (to.length === 0) return { error: 'Enter at least one valid email address' }

  if (statementData.rows.length === 0) {
    return { error: 'No statement data to send' }
  }

  const { base64, fileName } = getStatementPdfBase64(statementData)
  const period =
    statementData.dateFrom && statementData.dateTo
      ? `${statementData.dateFrom} – ${statementData.dateTo}`
      : 'selected period'
  const subject = `Statement — ${statementData.dealerName} (${period})`
  const documentTitle = `Statement — ${statementData.dealerName}`
  const bodyIntro = `Please find attached the account statement for ${statementData.dealerName} covering ${period}.`

  const result = await sendDocumentPdfEmail({
    to,
    subject,
    documentTitle,
    bodyIntro,
    pdfBase64: base64,
    fileName,
    senderId: user.id,
    mailType: 'statement',
    bodyHtmlExtra: buildStatementInvoicesEmailHtml(statementData.rows),
  })

  if (!result.success) return { error: result.error ?? 'Failed to send email' }
  return { success: true }
}
