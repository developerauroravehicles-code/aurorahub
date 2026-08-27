import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGoogleDriveSettingsFromDb } from '@/lib/specialist-expense-claims'
import {
  archiveSignedDocumentToDrive,
  downloadSignedEnvelopeDocument,
  getDocuSignSettingsFromDb,
} from '@/lib/docusign'

type ConnectPayload = {
  event?: string
  data?: {
    envelopeId?: string
    envelopeSummary?: { status?: string }
  }
  envelopeId?: string
}

export async function POST(request: Request) {
  let payload: ConnectPayload
  try {
    payload = (await request.json()) as ConnectPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const envelopeId =
    payload.data?.envelopeId ?? payload.envelopeId ?? null
  const event = payload.event ?? payload.data?.envelopeSummary?.status ?? ''

  if (!envelopeId) {
    return NextResponse.json({ received: true })
  }

  const isCompleted =
    event === 'envelope-completed' ||
    event === 'completed' ||
    payload.data?.envelopeSummary?.status === 'completed'

  if (!isCompleted) {
    return NextResponse.json({ received: true })
  }

  const admin = createAdminClient()
  const dsSettings = await getDocuSignSettingsFromDb(admin)
  const driveSettings = await getGoogleDriveSettingsFromDb(admin)

  if (!dsSettings?.enabled || !driveSettings) {
    return NextResponse.json({ error: 'Integration not configured' }, { status: 503 })
  }

  const { data: assignment } = await admin
    .from('personnel_document_assignments')
    .select(`
      id, personnel_id, signed_drive_file_id,
      template:compliance_document_templates(code, category),
      personnel:personnel(full_name, worker_id)
    `)
    .eq('docusign_envelope_id', envelopeId)
    .maybeSingle()

  if (!assignment || assignment.signed_drive_file_id) {
    return NextResponse.json({ received: true })
  }

  const signed = await downloadSignedEnvelopeDocument(dsSettings, envelopeId)
  if ('error' in signed) {
    console.error('DocuSign download failed:', signed.error)
    return NextResponse.json({ error: signed.error }, { status: 502 })
  }

  const template = Array.isArray(assignment.template) ? assignment.template[0] : assignment.template
  const person = Array.isArray(assignment.personnel) ? assignment.personnel[0] : assignment.personnel

  const archive = await archiveSignedDocumentToDrive(driveSettings, {
    envelopeId,
    assignmentId: assignment.id,
    templateCode: template?.code ?? 'signed',
    workerId: person?.worker_id ?? assignment.personnel_id.slice(0, 8),
    fullName: person?.full_name ?? 'Employee',
    category: template?.category ?? 'onboarding',
    signedBuffer: signed.buffer,
  })

  if ('error' in archive) {
    console.error('Drive archive failed:', archive.error)
    return NextResponse.json({ error: archive.error }, { status: 502 })
  }

  await admin
    .from('personnel_document_assignments')
    .update({
      status: 'signed',
      docusign_status: 'completed',
      signed_at: new Date().toISOString(),
      signed_drive_file_id: archive.fileId,
      drive_web_view_link: archive.webViewLink ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignment.id)

  await admin.from('compliance_document_events').insert({
    assignment_id: assignment.id,
    event_type: 'docusign_signed',
    payload: { envelope_id: envelopeId, signed_file_id: archive.fileId },
  })

  return NextResponse.json({ received: true })
}
