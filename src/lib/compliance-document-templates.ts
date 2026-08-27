import { createHash } from 'crypto'
import { format } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GoogleDriveSettings } from '@/lib/google-drive'
import { uploadCompliancePdfToDrive } from '@/lib/google-drive-documents'
import { buildCompliancePdf } from '@/lib/compliance-pdf-builder'
import type { ComplianceDocCategory } from '@/lib/compliance-document-types'

export { buildCompliancePdf } from '@/lib/compliance-pdf-builder'

export type PersonnelMergeContext = {
  full_name: string
  email: string
  address: string
  start_date: string
  end_date: string
  job_title: string
  province: string
  worker_id: string
  manager_name: string
  today_date: string
}

const PROVINCE_LABELS: Record<string, string> = {
  ontario: 'Ontario',
  british_columbia: 'British Columbia',
  alberta: 'Alberta',
  quebec: 'Quebec',
  manitoba: 'Manitoba',
  saskatchewan: 'Saskatchewan',
  nova_scotia: 'Nova Scotia',
  new_brunswick: 'New Brunswick',
  newfoundland: 'Newfoundland',
  pei: 'Prince Edward Island',
  yukon: 'Yukon',
  nwt: 'Northwest Territories',
  nunavut: 'Nunavut',
  out_of_canada: 'Out of Canada',
}

export function mergeTemplateBody(body: string, ctx: PersonnelMergeContext): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = ctx[key as keyof PersonnelMergeContext]
    return val ?? ''
  })
}

export async function fetchPersonnelMergeContext(
  supabase: SupabaseClient,
  personnelId: string
): Promise<PersonnelMergeContext | null> {
  const { data: person } = await supabase
    .from('personnel')
    .select(`
      full_name, email, worker_id, start_date, end_date, province, position, address,
      assigned_manager_id,
      hr_org_roles(name)
    `)
    .eq('id', personnelId)
    .single()

  if (!person) return null

  let managerName = ''
  if (person.assigned_manager_id) {
    const { data: mgr } = await supabase
      .from('personnel')
      .select('full_name')
      .eq('id', person.assigned_manager_id)
      .single()
    managerName = mgr?.full_name ?? ''
  }

  const orgRole = person.hr_org_roles as { name?: string } | { name?: string }[] | null
  const jobTitle = Array.isArray(orgRole) ? orgRole[0]?.name : orgRole?.name
  const addressParts = [person.address].filter(Boolean)

  const provinceLabel = person.province
    ? PROVINCE_LABELS[person.province] ?? person.province
    : ''

  return {
    full_name: person.full_name ?? '',
    email: person.email ?? '',
    address: addressParts.join(', '),
    start_date: person.start_date ? format(new Date(person.start_date), 'MMMM d, yyyy') : '',
    end_date: person.end_date ? format(new Date(person.end_date), 'MMMM d, yyyy') : '',
    job_title: jobTitle ?? person.position ?? '',
    province: provinceLabel,
    worker_id: person.worker_id ?? '',
    manager_name: managerName,
    today_date: format(new Date(), 'MMMM d, yyyy'),
  }
}

export function computeContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export type GeneratePdfResult =
  | {
      success: true
      buffer: Buffer
      contentHash: string
      fileName: string
      driveFileId: string
      webViewLink?: string
      folderPath: string
    }
  | { success: false; error: string }

export async function generateAndUploadCompliancePdf(
  driveSettings: GoogleDriveSettings,
  params: {
    templateCode: string
    templateName: string
    templateBody: string
    category: ComplianceDocCategory
    workerId: string
    fullName: string
    mergeContext: PersonnelMergeContext
    existingDriveFileId?: string | null
  }
): Promise<GeneratePdfResult> {
  const merged = mergeTemplateBody(params.templateBody, params.mergeContext)
  const buffer = buildCompliancePdf(params.templateName, merged)
  const contentHash = computeContentHash(buffer)
  const safeCode = params.templateCode.replace(/[^a-z0-9_-]/gi, '_')
  const fileName = `${safeCode}_${Date.now()}.pdf`

  const upload = await uploadCompliancePdfToDrive(
    driveSettings,
    {
      workerId: params.workerId,
      fullName: params.fullName,
      category: params.category,
    },
    fileName,
    buffer,
    params.existingDriveFileId
  )

  if (!upload.success) return { success: false, error: upload.error }

  return {
    success: true,
    buffer,
    contentHash,
    fileName,
    driveFileId: upload.fileId,
    webViewLink: upload.webViewLink,
    folderPath: upload.folderPath,
  }
}
