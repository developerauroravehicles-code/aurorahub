import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { fieldError, readJson, requireFieldSpecialist } from '@/lib/field/auth'
import { itRequestSchema } from '@/lib/field/schemas'
import { createITRequestCore } from '@/lib/self/requests'

/** POST /api/field/self/it-requests — open an IT ticket (same rules as the Self Portal). */
export async function POST(request: Request) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  const parsed = itRequestSchema.safeParse(await readJson(request))
  if (!parsed.success) return fieldError('Invalid IT request', 400)

  const result = await createITRequestCore(ctx.supabase, ctx.user.id, parsed.data)
  if ('error' in result) return fieldError(result.error, 422)

  revalidatePath('/dashboard/self')
  return NextResponse.json({ success: true })
}
