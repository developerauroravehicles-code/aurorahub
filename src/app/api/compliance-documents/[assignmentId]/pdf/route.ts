import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleDriveSettingsFromDb } from '@/lib/specialist-expense-claims'
import { downloadDriveFile } from '@/lib/google-drive-documents'

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

export async function GET(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await context.params
  const download = new URL(request.url).searchParams.get('download') === '1'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
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

  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const person = Array.isArray(assignment.personnel) ? assignment.personnel[0] : assignment.personnel
  const isOwner = person?.profile_id === user.id
  if (!isHr && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const fileId = assignment.signed_drive_file_id ?? assignment.drive_file_id
  if (!fileId) return NextResponse.json({ error: 'No document file' }, { status: 404 })

  const driveSettings = await getGoogleDriveSettingsFromDb(supabase)
  if (!driveSettings) return NextResponse.json({ error: 'Drive not configured' }, { status: 503 })

  const file = await downloadDriveFile(driveSettings, fileId)
  if (!file.success) return NextResponse.json({ error: file.error }, { status: 502 })

  const template = Array.isArray(assignment.template) ? assignment.template[0] : assignment.template
  const baseName = sanitizeFilename(template?.name ?? template?.code ?? 'document')
  const ext = extensionForMime(file.mimeType)
  const fileName = baseName.endsWith(ext) || !ext ? baseName : `${baseName}${ext}`

  if (download) {
    await supabase.from('compliance_document_events').insert({
      assignment_id: assignmentId,
      event_type: 'viewed',
      actor_id: user.id,
      payload: { download: true, file_name: fileName },
    })
  }

  const contentType = file.mimeType.includes('pdf') ? 'application/pdf' : file.mimeType

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': download
        ? `attachment; filename="${fileName}"`
        : 'inline',
      'Cache-Control': 'private, no-store',
    },
  })
}
