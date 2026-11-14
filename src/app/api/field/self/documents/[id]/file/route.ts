import { NextResponse } from 'next/server'
import { requireFieldSpecialist } from '@/lib/field/auth'
import { loadAssignmentFileCore } from '@/lib/self/documents'

/** GET /api/field/self/documents/:id/file — the assignment's PDF (or uploaded file). */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  const { id } = await context.params
  const file = await loadAssignmentFileCore(ctx.supabase, ctx.user.id, id, { logDownload: false })
  if ('error' in file) return NextResponse.json({ error: file.error }, { status: file.status })

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': 'inline',
      'X-File-Name': encodeURIComponent(file.fileName),
      'Cache-Control': 'private, no-store',
    },
  })
}
