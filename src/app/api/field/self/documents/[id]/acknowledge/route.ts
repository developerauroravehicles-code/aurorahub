import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { fieldError, requireFieldSpecialist } from '@/lib/field/auth'
import { acknowledgeDocumentCore } from '@/lib/self/documents'

/** POST /api/field/self/documents/:id/acknowledge — "I have read and understood". */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? null
  const userAgent = request.headers.get('user-agent') ?? null

  const { id } = await context.params
  const result = await acknowledgeDocumentCore(ctx.supabase, ctx.user.id, id, { ip, userAgent })
  if ('error' in result) return fieldError(result.error, 422)

  revalidatePath('/dashboard/self')
  return NextResponse.json({ success: true })
}
