import type { SupabaseClient } from '@supabase/supabase-js'
import { getGoogleDriveSettingsFromDb } from '@/lib/specialist-expense-claims'
import { downloadDriveFile, uploadComplianceFileToDrive } from '@/lib/google-drive-documents'
import type { ComplianceDocumentEventType } from '@/lib/compliance-document-types'

type Result = { error: string } | { success: true }

type AssignmentTemplate = {
  requires_scroll_ack: boolean | null
  interaction_type: string | null
  category: string | null
  code: string | null
  name: string | null
}

async function getSelfPersonnel(supabase: SupabaseClient, userId: string) {
  const { data: person } = await supabase
    .from('personnel')
    .select('id, full_name, worker_id, email')
    .eq('profile_id', userId)
    .is('dealer_id', null)
    .single()
  return person
}

async function logEvent(
  supabase: SupabaseClient,
  assignmentId: string,
  eventType: ComplianceDocumentEventType,
  actorId: string | null,
  payload: Record<string, unknown> = {}
) {
  await supabase.from('compliance_document_events').insert({
    assignment_id: assignmentId,
    event_type: eventType,
    actor_id: actorId,
    payload,
  })
}

async function ensureOwnAssignment(supabase: SupabaseClient, assignmentId: string, userId: string) {
  const person = await getSelfPersonnel(supabase, userId)
  if (!person) return { ok: false as const, error: 'Personnel record not found' }

  const { data: assignment } = await supabase
    .from('personnel_document_assignments')
    .select(`
      id, personnel_id, status, scroll_completed_at,
      template:compliance_document_templates(requires_scroll_ack, interaction_type, category, code, name)
    `)
    .eq('id', assignmentId)
    .eq('personnel_id', person.id)
    .single()

  if (!assignment) return { ok: false as const, error: 'Assignment not found' }
  const template = (Array.isArray(assignment.template)
    ? assignment.template[0]
    : assignment.template) as AssignmentTemplate | null
  return { ok: true as const, person, assignment, template }
}

/** Personnel id for the signed-in platform user, if they have an HR record. */
export async function getSelfPersonnelId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  return (await getSelfPersonnel(supabase, userId))?.id ?? null
}

export async function recordDocumentViewCore(
  supabase: SupabaseClient,
  userId: string,
  assignmentId: string
): Promise<Result> {
  const check = await ensureOwnAssignment(supabase, assignmentId, userId)
  if (!check.ok) return { error: check.error }
  await logEvent(supabase, assignmentId, 'viewed', userId)
  return { success: true }
}

export async function recordScrollCompletedCore(
  supabase: SupabaseClient,
  userId: string,
  assignmentId: string,
  scrollPercent: number
): Promise<Result> {
  const check = await ensureOwnAssignment(supabase, assignmentId, userId)
  if (!check.ok) return { error: check.error }
  if (!(scrollPercent >= 95)) return { error: 'Scroll at least 95% of the document' }

  const { error } = await supabase
    .from('personnel_document_assignments')
    .update({
      scroll_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
  if (error) return { error: error.message }

  await logEvent(supabase, assignmentId, 'scroll_completed', userId, { scroll_percent: scrollPercent })
  return { success: true }
}

export async function acknowledgeDocumentCore(
  supabase: SupabaseClient,
  userId: string,
  assignmentId: string,
  client: { ip: string | null; userAgent: string | null }
): Promise<Result> {
  const check = await ensureOwnAssignment(supabase, assignmentId, userId)
  if (!check.ok) return { error: check.error }

  const template = check.template
  if (template?.interaction_type !== 'acknowledge') {
    return { error: 'This document does not require acknowledgment' }
  }
  if (template.requires_scroll_ack && !check.assignment.scroll_completed_at) {
    return { error: 'Please read the entire document before acknowledging' }
  }

  const { error } = await supabase
    .from('personnel_document_assignments')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_ip: client.ip,
      ack_user_agent: client.userAgent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
  if (error) return { error: error.message }

  await logEvent(supabase, assignmentId, 'acknowledged', userId, {
    ip: client.ip,
    user_agent: client.userAgent,
  })
  return { success: true }
}

export async function uploadAssignmentDocumentCore(
  supabase: SupabaseClient,
  userId: string,
  assignmentId: string,
  file: { buffer: Buffer; name: string; type: string }
): Promise<Result> {
  const check = await ensureOwnAssignment(supabase, assignmentId, userId)
  if (!check.ok) return { error: check.error }

  const template = check.template
  if (template?.interaction_type !== 'upload') {
    return { error: 'This document is not an upload type' }
  }

  const driveSettings = await getGoogleDriveSettingsFromDb(supabase)
  if (!driveSettings) return { error: 'Document storage is not configured' }

  const upload = await uploadComplianceFileToDrive(
    driveSettings,
    {
      workerId: check.person.worker_id ?? check.person.id.slice(0, 8),
      fullName: check.person.full_name ?? 'Employee',
      category: (template.category ?? 'onboarding') as Parameters<typeof uploadComplianceFileToDrive>[1]['category'],
    },
    file.name,
    file.type || 'application/octet-stream',
    file.buffer
  )
  if (!upload.success) return { error: upload.error }

  const { error } = await supabase
    .from('personnel_document_assignments')
    .update({
      status: 'uploaded',
      drive_file_id: upload.fileId,
      drive_web_view_link: upload.webViewLink ?? null,
      drive_folder_path: upload.folderPath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
  if (error) return { error: error.message }

  await logEvent(supabase, assignmentId, 'uploaded', userId, {
    file_name: file.name,
    mime_type: file.type,
  })
  return { success: true }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'document'
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('pdf')) return '.pdf'
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg'
  if (mimeType.includes('png')) return '.png'
  if (mimeType.includes('webp')) return '.webp'
  if (mimeType.includes('word') || mimeType.includes('docx')) return '.docx'
  if (mimeType.includes('msword') || mimeType.includes('doc')) return '.doc'
  return ''
}

export type AssignmentFile = { buffer: Buffer; contentType: string; fileName: string }

/**
 * Downloads an assignment's (signed or generated) file from Drive. Owners and
 * HR / Aurora Manager / IT may read it. Logs a `viewed` event for downloads.
 */
export async function loadAssignmentFileCore(
  supabase: SupabaseClient,
  userId: string,
  assignmentId: string,
  options: { logDownload: boolean }
): Promise<AssignmentFile | { error: string; status: number }> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  const isHr = profile?.role === 'hr' || profile?.role === 'aurora_manager' || profile?.role === 'it'

  const { data: assignment } = await supabase
    .from('personnel_document_assignments')
    .select(`
      id, drive_file_id, signed_drive_file_id, personnel_id,
      personnel:personnel(profile_id),
      template:compliance_document_templates(name, code)
    `)
    .eq('id', assignmentId)
    .single()

  if (!assignment) return { error: 'Not found', status: 404 }

  const person = Array.isArray(assignment.personnel) ? assignment.personnel[0] : assignment.personnel
  const isOwner = person?.profile_id === userId
  if (!isHr && !isOwner) return { error: 'Forbidden', status: 403 }

  const fileId = assignment.signed_drive_file_id ?? assignment.drive_file_id
  if (!fileId) return { error: 'No document file', status: 404 }

  const driveSettings = await getGoogleDriveSettingsFromDb(supabase)
  if (!driveSettings) return { error: 'Drive not configured', status: 503 }

  const file = await downloadDriveFile(driveSettings, fileId)
  if (!file.success) return { error: file.error, status: 502 }

  const template = Array.isArray(assignment.template) ? assignment.template[0] : assignment.template
  const baseName = sanitizeFilename(template?.name ?? template?.code ?? 'document')
  const ext = extensionForMime(file.mimeType)
  const fileName = baseName.endsWith(ext) || !ext ? baseName : `${baseName}${ext}`

  if (options.logDownload) {
    await logEvent(supabase, assignmentId, 'viewed', userId, { download: true, file_name: fileName })
  }

  return {
    buffer: file.buffer,
    contentType: file.mimeType.includes('pdf') ? 'application/pdf' : file.mimeType,
    fileName,
  }
}
