'use server'

import { createClient } from '@/lib/supabase/server'
import { buildStatementPdf } from '@/lib/generate-statement-pdf'
import { uploadStatementToDrive, type GoogleDriveSettings } from '@/lib/google-drive'
import type { StatementPdfData } from '@/lib/generate-statement-pdf'

export interface DealerOption {
  id: string
  name: string
}

export interface StatementDemandRow {
  id: string
  demand_number: string | null
  updated_at: string
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  stock_number: string | null
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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Managers can view statements' }
  }

  let query = supabase
    .from('demands')
    .select(`
      id,
      demand_number,
      updated_at,
      vehicle_year,
      vehicle_make,
      vehicle_model,
      stock_number,
      invoice_total_amount,
      dealers(name)
    `)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })

  if (dealerId) {
    query = query.eq('dealer_id', dealerId)
  }
  if (dateFrom) {
    query = query.gte('updated_at', `${dateFrom}T00:00:00.000Z`)
  }
  if (dateTo) {
    query = query.lte('updated_at', `${dateTo}T23:59:59.999Z`)
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
    return { success: false, error: 'Only Aurora Managers can upload statements to Drive' }
  }

  const { data: settingsRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'google_drive_settings')
    .single()

  if (!settingsRow?.value) {
    return { success: false, error: 'Google Drive not configured. Configure in System Management > API.' }
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
