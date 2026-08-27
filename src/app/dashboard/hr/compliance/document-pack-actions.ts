'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getGoogleDriveSettingsFromDb } from '@/lib/specialist-expense-claims'
import {
  fetchPersonnelMergeContext,
  generateAndUploadCompliancePdf,
} from '@/lib/compliance-document-templates'
import {
  createDocuSignEnvelope,
  createEmbeddedSigningUrl,
  downloadDrivePdfBase64,
  getDocuSignSettingsFromDb,
} from '@/lib/docusign'
import type { ComplianceDocCategory, ComplianceDocumentEventType } from '@/lib/compliance-document-types'

async function ensureHrAuth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const, supabase: null, userId: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'hr' && profile?.role !== 'aurora_manager' && profile?.role !== 'it') {
    return { error: 'Unauthorized' as const, supabase: null, userId: null }
  }
  return { supabase, userId: user.id }
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

async function sendDocuSignInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string,
  actorId: string | null
): Promise<{ success: true; envelopeId: string; alreadySent?: boolean } | { error: string }> {
  const dsSettings = await getDocuSignSettingsFromDb(supabase)
  if (!dsSettings?.enabled) return { error: 'DocuSign is not configured or disabled' }

  const driveSettings = await getGoogleDriveSettingsFromDb(supabase)
  if (!driveSettings) return { error: 'Google Drive is not configured' }

  const { data: assignment } = await supabase
    .from('personnel_document_assignments')
    .select(`
      id, personnel_id, drive_file_id, docusign_envelope_id,
      template:compliance_document_templates(code, name, category, interaction_type),
      personnel:personnel(full_name, email, worker_id)
    `)
    .eq('id', assignmentId)
    .single()

  if (!assignment?.drive_file_id) return { error: 'Generate the document before sending for signature' }

  const template = Array.isArray(assignment.template) ? assignment.template[0] : assignment.template
  const person = Array.isArray(assignment.personnel) ? assignment.personnel[0] : assignment.personnel

  if (template?.interaction_type !== 'docusign') {
    return { error: 'This document does not require DocuSign' }
  }
  if (!person?.email) return { error: 'Personnel email is required for DocuSign' }

  if (assignment.docusign_envelope_id) {
    return { success: true, envelopeId: assignment.docusign_envelope_id, alreadySent: true }
  }

  const pdf = await downloadDrivePdfBase64(driveSettings, assignment.drive_file_id)
  if ('error' in pdf) return { error: pdf.error }

  const envelope = await createDocuSignEnvelope(dsSettings, {
    documentBase64: pdf.base64,
    documentName: template.name,
    signerEmail: person.email,
    signerName: person.full_name ?? 'Employee',
    emailSubject: `Please sign: ${template.name}`,
    clientUserId: assignment.personnel_id,
  })

  if ('error' in envelope) return { error: envelope.error }

  const { error } = await supabase
    .from('personnel_document_assignments')
    .update({
      docusign_envelope_id: envelope.envelopeId,
      docusign_status: 'sent',
      status: 'pending_signature',
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)

  if (error) return { error: error.message }

  await logEvent(supabase, assignmentId, 'docusign_sent', actorId, {
    envelope_id: envelope.envelopeId,
  })

  return { success: true, envelopeId: envelope.envelopeId }
}

export async function preparePendingAssignmentsForPersonnel(personnelId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: person } = await supabase
    .from('personnel')
    .select('id')
    .eq('profile_id', user.id)
    .eq('id', personnelId)
    .is('dealer_id', null)
    .single()

  if (!person) return { error: 'Unauthorized' }

  const { data: assignments } = await supabase
    .from('personnel_document_assignments')
    .select(`
      id, status, template_version,
      template:compliance_document_templates(interaction_type, template_version)
    `)
    .eq('personnel_id', personnelId)

  for (const a of assignments ?? []) {
    const t = Array.isArray(a.template) ? a.template[0] : a.template
    if (t?.interaction_type === 'upload') continue
    if (a.status === 'cancelled') continue

    const templateVersion = t?.template_version ?? a.template_version
    const outdated =
      templateVersion != null && a.template_version != null && a.template_version < templateVersion
    const needsGenerate =
      a.status === 'assigned' ||
      (outdated && ['pending_ack', 'pending_signature', 'generated'].includes(a.status))

    if (needsGenerate) {
      await generateAssignmentInternal(supabase, a.id, user.id)
    }
  }

  return { success: true }
}

export async function assignDocumentPack(personnelId: string, category: ComplianceDocCategory) {
  const auth = await ensureHrAuth()
  if (!auth.supabase) return { error: auth.error }

  const { data: templates } = await auth.supabase
    .from('compliance_document_templates')
    .select('id, template_version')
    .eq('category', category)
    .eq('is_active', true)
    .order('sort_order')

  if (!templates?.length) return { error: 'No active templates for this category' }

  const rows = templates.map((t) => ({
    personnel_id: personnelId,
    template_id: t.id,
    template_version: t.template_version,
    status: 'assigned' as const,
    assigned_by: auth.userId,
  }))

  const { error } = await auth.supabase
    .from('personnel_document_assignments')
    .upsert(rows, { onConflict: 'personnel_id,template_id', ignoreDuplicates: true })

  if (error) return { error: error.message }

  await generateAllAssignments(personnelId, category)

  const templateIds = templates.map((t) => t.id)
  await auth.supabase
    .from('personnel_document_assignments')
    .update({
      status: 'assigned',
      assigned_by: auth.userId,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('personnel_id', personnelId)
    .in('template_id', templateIds)
    .eq('status', 'cancelled')

  revalidatePath('/dashboard/hr/compliance')
  revalidatePath(`/dashboard/hr/personnel/${personnelId}`)
  revalidatePath('/dashboard/self')
  return { success: true, count: rows.length }
}

export async function generateAssignment(assignmentId: string) {
  const auth = await ensureHrAuth()
  if (!auth.supabase) return { error: auth.error }
  const result = await generateAssignmentInternal(auth.supabase, assignmentId, auth.userId)
  if (result.error) return { error: result.error }
  revalidateCompliancePaths(result.personnelId)
  return { success: true }
}

export async function generateAssignmentInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string,
  actorId: string | null
) {
  const driveSettings = await getGoogleDriveSettingsFromDb(supabase)
  if (!driveSettings) return { error: 'Google Drive is not configured' }

  const { data: assignment } = await supabase
    .from('personnel_document_assignments')
    .select(`
      id, personnel_id, template_version, drive_file_id, status,
      template:compliance_document_templates(
        id, code, name, category, interaction_type, template_body, requires_scroll_ack, template_version
      ),
      personnel:personnel(full_name, worker_id, email)
    `)
    .eq('id', assignmentId)
    .single()

  if (!assignment?.template || !assignment.personnel) return { error: 'Assignment not found' }

  const template = Array.isArray(assignment.template) ? assignment.template[0] : assignment.template
  const person = Array.isArray(assignment.personnel) ? assignment.personnel[0] : assignment.personnel

  if (template.interaction_type === 'upload') {
    return { error: 'Upload documents are not generated — employee uploads directly.' }
  }

  const mergeContext = await fetchPersonnelMergeContext(supabase, assignment.personnel_id)
  if (!mergeContext) return { error: 'Personnel not found' }

  const body =
    template.template_body ??
    `${template.name}\n\nEmployee: {{full_name}}\nDate: {{today_date}}`

  const result = await generateAndUploadCompliancePdf(driveSettings, {
    templateCode: template.code,
    templateName: template.name,
    templateBody: body,
    category: template.category,
    workerId: person.worker_id ?? assignment.personnel_id.slice(0, 8),
    fullName: person.full_name ?? 'Employee',
    mergeContext,
    existingDriveFileId: assignment.drive_file_id,
  })

  if (!result.success) return { error: result.error }

  let nextStatus: string
  if (template.interaction_type === 'acknowledge') {
    nextStatus = 'pending_ack'
  } else if (template.interaction_type === 'docusign') {
    nextStatus = 'pending_signature'
  } else {
    nextStatus = 'generated'
  }

  const { error } = await supabase
    .from('personnel_document_assignments')
    .update({
      status: nextStatus,
      template_version: template.template_version ?? assignment.template_version,
      drive_file_id: result.driveFileId,
      drive_web_view_link: result.webViewLink ?? null,
      drive_folder_path: result.folderPath,
      content_hash: result.contentHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)

  if (error) return { error: error.message }

  await logEvent(supabase, assignmentId, 'generated', actorId, {
    content_hash: result.contentHash,
    template_version: assignment.template_version,
    file_name: result.fileName,
  })

  if (template.interaction_type === 'docusign') {
    await sendDocuSignInternal(supabase, assignmentId, actorId)
  }

  return { success: true, personnelId: assignment.personnel_id as string }
}

function revalidateCompliancePaths(personnelId?: string | null) {
  revalidatePath('/dashboard/hr/compliance')
  if (personnelId) revalidatePath(`/dashboard/hr/personnel/${personnelId}`)
  revalidatePath('/dashboard/self')
}

export async function generateAllAssignments(personnelId: string, category: ComplianceDocCategory) {
  const auth = await ensureHrAuth()
  if (!auth.supabase) return { error: auth.error }

  const { data: assignments } = await auth.supabase
    .from('personnel_document_assignments')
    .select(`
      id,
      template:compliance_document_templates(category, interaction_type)
    `)
    .eq('personnel_id', personnelId)

  const toGenerate = (assignments ?? []).filter((a) => {
    const t = Array.isArray(a.template) ? a.template[0] : a.template
    return t?.category === category && t?.interaction_type !== 'upload'
  })

  let generated = 0
  const errors: string[] = []
  for (const a of toGenerate) {
    const res = await generateAssignmentInternal(auth.supabase, a.id, auth.userId)
    if (res.error) errors.push(res.error)
    else generated++
  }

  revalidateCompliancePaths(personnelId)
  return { success: true, generated, errors }
}

export async function sendDocuSign(assignmentId: string) {
  const auth = await ensureHrAuth()
  if (!auth.supabase) return { error: auth.error }

  const result = await sendDocuSignInternal(auth.supabase, assignmentId, auth.userId)
  if ('error' in result) return { error: result.error }

  const { data: assignment } = await auth.supabase
    .from('personnel_document_assignments')
    .select('personnel_id')
    .eq('id', assignmentId)
    .single()

  revalidatePath('/dashboard/hr/compliance')
  if (assignment?.personnel_id) {
    revalidatePath(`/dashboard/hr/personnel/${assignment.personnel_id}`)
  }
  revalidatePath('/dashboard/self')
  return { success: true, envelopeId: result.envelopeId, alreadySent: result.alreadySent }
}

export async function verifyUploadedDocument(assignmentId: string) {
  const auth = await ensureHrAuth()
  if (!auth.supabase) return { error: auth.error }

  const { data: assignment } = await auth.supabase
    .from('personnel_document_assignments')
    .select('id, personnel_id, status')
    .eq('id', assignmentId)
    .single()

  if (!assignment) return { error: 'Assignment not found' }
  if (assignment.status !== 'uploaded') {
    return { error: 'Document must be in uploaded status to verify' }
  }

  const { error } = await auth.supabase
    .from('personnel_document_assignments')
    .update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)

  if (error) return { error: error.message }

  await logEvent(auth.supabase, assignmentId, 'hr_verified', auth.userId)

  revalidatePath('/dashboard/hr/compliance')
  revalidatePath(`/dashboard/hr/personnel/${assignment.personnel_id}`)
  return { success: true }
}

export async function getEmbeddedSigningUrl(assignmentId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const dsSettings = await getDocuSignSettingsFromDb(supabase)
  if (!dsSettings?.enabled) return { error: 'DocuSign is not configured' }

  const { data: assignment } = await supabase
    .from('personnel_document_assignments')
    .select(`
      id, personnel_id, docusign_envelope_id, drive_file_id, status,
      template:compliance_document_templates(interaction_type),
      personnel:personnel(profile_id, full_name, email)
    `)
    .eq('id', assignmentId)
    .single()

  const person = assignment?.personnel
    ? Array.isArray(assignment.personnel)
      ? assignment.personnel[0]
      : assignment.personnel
    : null

  if (!assignment || !person) {
    return { error: 'Signing session not available' }
  }
  if (person.profile_id !== user.id) return { error: 'Unauthorized' }
  if (!person.email) return { error: 'Email required for signing' }

  let envelopeId = assignment.docusign_envelope_id
  if (!envelopeId) {
    if (assignment.status === 'assigned' && assignment.drive_file_id == null) {
      const gen = await generateAssignmentInternal(supabase, assignmentId, user.id)
      if (gen.error) return { error: gen.error }
    } else if (!assignment.drive_file_id) {
      return { error: 'Document is not ready for signing yet' }
    }

    const sent = await sendDocuSignInternal(supabase, assignmentId, user.id)
    if ('error' in sent) return { error: sent.error }
    envelopeId = sent.envelopeId
  }

  if (!envelopeId) {
    return { error: 'Signing session not available' }
  }

  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? 'https'
  const returnUrl = `${proto}://${host}/dashboard/self?tab=documents&signed=${assignmentId}`

  const urlResult = await createEmbeddedSigningUrl(dsSettings, {
    envelopeId,
    signerEmail: person.email,
    signerName: person.full_name ?? 'Employee',
    clientUserId: assignment.personnel_id,
    returnUrl,
  })

  if ('error' in urlResult) return { error: urlResult.error }
  return { url: urlResult.url }
}

export async function toggleTemplateActive(templateId: string, isActive: boolean) {
  const auth = await ensureHrAuth()
  if (!auth.supabase) return { error: auth.error }

  const { error } = await auth.supabase
    .from('compliance_document_templates')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', templateId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/compliance')
  return { success: true }
}

const CANCELLABLE_ASSIGNMENT_STATUSES = [
  'assigned',
  'generated',
  'pending_ack',
  'pending_signature',
  'uploaded',
] as const

export async function cancelAssignment(assignmentId: string) {
  const auth = await ensureHrAuth()
  if (!auth.supabase) return { error: auth.error }

  const { data: assignment } = await auth.supabase
    .from('personnel_document_assignments')
    .select('id, personnel_id, status')
    .eq('id', assignmentId)
    .single()

  if (!assignment) return { error: 'Assignment not found' }
  if (!(CANCELLABLE_ASSIGNMENT_STATUSES as readonly string[]).includes(assignment.status)) {
    return { error: 'Completed documents cannot be cancelled. Only pending assignments can be removed.' }
  }

  const { error } = await auth.supabase
    .from('personnel_document_assignments')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)

  if (error) return { error: error.message }

  await logEvent(auth.supabase, assignmentId, 'cancelled', auth.userId)

  revalidateCompliancePaths(assignment.personnel_id)
  return { success: true }
}

export async function cancelDocumentPack(personnelId: string, category: ComplianceDocCategory) {
  const auth = await ensureHrAuth()
  if (!auth.supabase) return { error: auth.error }

  const { data: assignments } = await auth.supabase
    .from('personnel_document_assignments')
    .select(`
      id, status,
      template:compliance_document_templates(category)
    `)
    .eq('personnel_id', personnelId)
    .in('status', [...CANCELLABLE_ASSIGNMENT_STATUSES])

  const toCancel = (assignments ?? []).filter((a) => {
    const t = Array.isArray(a.template) ? a.template[0] : a.template
    return t?.category === category
  })

  if (toCancel.length === 0) {
    return { error: 'No cancellable assignments in this pack.' }
  }

  for (const a of toCancel) {
    await auth.supabase
      .from('personnel_document_assignments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', a.id)
    await logEvent(auth.supabase, a.id, 'cancelled', auth.userId)
  }

  revalidateCompliancePaths(personnelId)
  return { success: true, count: toCancel.length }
}

export async function assignOffboardingPackInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  personnelId: string,
  assignedBy: string | null
) {
  const { data: templates } = await supabase
    .from('compliance_document_templates')
    .select('id, template_version')
    .eq('category', 'offboarding')
    .eq('is_active', true)
    .order('sort_order')

  if (!templates?.length) return { count: 0 }

  const rows = templates.map((t) => ({
    personnel_id: personnelId,
    template_id: t.id,
    template_version: t.template_version,
    status: 'assigned' as const,
    assigned_by: assignedBy,
  }))

  await supabase
    .from('personnel_document_assignments')
    .upsert(rows, { onConflict: 'personnel_id,template_id', ignoreDuplicates: true })

  const driveSettings = await getGoogleDriveSettingsFromDb(supabase)
  if (driveSettings) {
    const { data: hrGenerated } = await supabase
      .from('personnel_document_assignments')
      .select(`
        id,
        template:compliance_document_templates(interaction_type, category)
      `)
      .eq('personnel_id', personnelId)

    for (const a of hrGenerated ?? []) {
      const t = Array.isArray(a.template) ? a.template[0] : a.template
      if (t?.interaction_type === 'hr_generated' && t.category === 'offboarding') {
        await generateAssignmentInternal(supabase, a.id, assignedBy)
      }
    }
  }

  return { count: rows.length }
}
