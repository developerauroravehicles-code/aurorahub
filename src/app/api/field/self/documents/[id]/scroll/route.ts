import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { fieldError, readJson, requireFieldSpecialist } from '@/lib/field/auth'
import { scrollProgressSchema } from '@/lib/field/schemas'
import { recordScrollCompletedCore } from '@/lib/self/documents'

/** POST /api/field/self/documents/:id/scroll { percent } — read-to-the-end gate for acknowledgment. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  const parsed = scrollProgressSchema.safeParse(await readJson(request))
  if (!parsed.success) return fieldError('Invalid scroll progress', 400)

  const { id } = await context.params
  const result = await recordScrollCompletedCore(ctx.supabase, ctx.user.id, id, parsed.data.percent)
  if ('error' in result) return fieldError(result.error, 422)

  revalidatePath('/dashboard/self')
  return NextResponse.json({ success: true })
}
