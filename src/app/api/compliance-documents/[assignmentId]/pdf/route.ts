import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadAssignmentFileCore } from '@/lib/self/documents'

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

  const file = await loadAssignmentFileCore(supabase, user.id, assignmentId, { logDownload: download })
  if ('error' in file) return NextResponse.json({ error: file.error }, { status: file.status })

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': download ? `attachment; filename="${file.fileName}"` : 'inline',
      'Cache-Control': 'private, no-store',
    },
  })
}
