'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getGoogleDriveSettingsFromDb } from '@/lib/specialist-expense-claims'
import { uploadComplianceFileToDrive } from '@/lib/google-drive-documents'
import type { ComplianceDocumentEventType } from '@/lib/compliance-document-types'

async function getSelfPersonnelId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: person } = await supabase
    .from('personnel')
    .select('id, full_name, worker_id, email')
    .eq('profile_id', userId)
    .is('dealer_id', null)
    .single()
  return person
}

async function logEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

async function ensureOwnAssignment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string,
  userId: string
) {
  const person = await getSelfPersonnelId(supabase, userId)
  if (!person) return { error: 'Personnel record not found' as const }

  const { data: assignment } = await supabase
    .from('personnel_document_assignments')
    .select(`
      id, personnel_id, status, scroll_completed_at,
      template:compliance_document_templates(requires_scroll_ack, interaction_type, category, code, name)
    `)
    .eq('id', assignmentId)
    .eq('personnel_id', person.id)
    .single()

  if (!assignment) return { error: 'Assignment not found' as const }
  return { person, assignment }
}

export async function recordDocumentView(assignmentId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const check = await ensureOwnAssignment(supabase, assignmentId, user.id)
  if ('error' in check) return { error: check.error }

  await logEvent(supabase, assignmentId, 'viewed', user.id)
  return { success: true }
}

export async function recordScrollCompleted(assignmentId: string, scrollPercent: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const check = await ensureOwnAssignment(supabase, assignmentId, user.id)
  if ('error' in check) return { error: check.error }

  if (scrollPercent < 95) return { error: 'Scroll at least 95% of the document' }

  const { error } = await supabase
    .from('personnel_document_assignments')
    .update({
      scroll_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)

  if (error) return { error: error.message }

  await logEvent(supabase, assignmentId, 'scroll_completed', user.id, { scroll_percent: scrollPercent })
  revalidatePath('/dashboard/self')
  return { success: true }
}

export async function acknowledgeDocument(assignmentId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const check = await ensureOwnAssignment(supabase, assignmentId, user.id)
  if ('error' in check) return { error: check.error }

  const template = Array.isArray(check.assignment.template)
    ? check.assignment.template[0]
    : check.assignment.template

  if (template?.interaction_type !== 'acknowledge') {
    return { error: 'This document does not require acknowledgment' }
  }

  if (template.requires_scroll_ack && !check.assignment.scroll_completed_at) {
    return { error: 'Please read the entire document before acknowledging' }
  }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null
  const userAgent = hdrs.get('user-agent') ?? null

  const { error } = await supabase
    .from('personnel_document_assignments')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_ip: ip,
      ack_user_agent: userAgent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)

  if (error) return { error: error.message }

  await logEvent(supabase, assignmentId, 'acknowledged', user.id, { ip, user_agent: userAgent })
  revalidatePath('/dashboard/self')
  return { success: true }
}

export async function uploadAssignmentDocument(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const assignmentId = String(formData.get('assignmentId') ?? '')
  const file = formData.get('file')
  if (!assignmentId || !(file instanceof File)) return { error: 'File and assignment required' }

  const check = await ensureOwnAssignment(supabase, assignmentId, user.id)
  if ('error' in check) return { error: check.error }

  const template = Array.isArray(check.assignment.template)
    ? check.assignment.template[0]
    : check.assignment.template

  if (template?.interaction_type !== 'upload') {
    return { error: 'This document is not an upload type' }
  }

  const driveSettings = await getGoogleDriveSettingsFromDb(supabase)
  if (!driveSettings) return { error: 'Document storage is not configured' }

  const buffer = Buffer.from(await file.arrayBuffer())
  const upload = await uploadComplianceFileToDrive(
    driveSettings,
    {
      workerId: check.person.worker_id ?? check.person.id.slice(0, 8),
      fullName: check.person.full_name ?? 'Employee',
      category: template.category ?? 'onboarding',
    },
    file.name,
    file.type || 'application/octet-stream',
    buffer
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

  await logEvent(supabase, assignmentId, 'uploaded', user.id, {
    file_name: file.name,
    mime_type: file.type,
  })

  revalidatePath('/dashboard/self')
  revalidatePath('/dashboard/hr/compliance')
  return { success: true }
}
