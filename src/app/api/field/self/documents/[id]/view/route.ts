import { NextResponse } from 'next/server'
import { fieldError, requireFieldSpecialist } from '@/lib/field/auth'
import { recordDocumentViewCore } from '@/lib/self/documents'

/** POST /api/field/self/documents/:id/view — logs that the document was opened. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  const { id } = await context.params
  const result = await recordDocumentViewCore(ctx.supabase, ctx.user.id, id)
  if ('error' in result) return fieldError(result.error, 404)
  return NextResponse.json({ success: true })
}
