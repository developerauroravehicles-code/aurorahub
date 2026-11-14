import { NextResponse } from 'next/server'
import { fieldError, readJson, requireFieldSpecialist } from '@/lib/field/auth'
import { extraDutyPreviewSchema } from '@/lib/field/schemas'
import { expenseAccessError, previewExtraDutyCore } from '@/lib/self/expenses'

/** POST /api/field/self/expenses/preview { hours, minutes } — extra duty amount from salary. */
export async function POST(request: Request) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  const accessError = expenseAccessError(ctx.profile)
  if (accessError) return fieldError(accessError, 403)

  const parsed = extraDutyPreviewSchema.safeParse(await readJson(request))
  if (!parsed.success) return fieldError('Enter hours and minutes', 400)

  const result = await previewExtraDutyCore(ctx.supabase, ctx.user.id, parsed.data.hours, parsed.data.minutes)
  if ('error' in result) return fieldError(result.error, 422)
  return NextResponse.json(result)
}
