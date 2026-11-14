import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { fieldError, readJson, requireFieldSpecialist } from '@/lib/field/auth'
import { leaveRequestSchema } from '@/lib/field/schemas'
import { requestLeaveCore } from '@/lib/self/requests'

/** POST /api/field/self/leave — request leave (same rules as the Self Portal). */
export async function POST(request: Request) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  const parsed = leaveRequestSchema.safeParse(await readJson(request))
  if (!parsed.success) return fieldError('Invalid leave request', 400)

  const result = await requestLeaveCore(ctx.supabase, ctx.user.id, {
    leave_type: parsed.data.leaveType,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    notes: parsed.data.notes,
  })
  if ('error' in result) return fieldError(result.error, 422)

  revalidatePath('/dashboard/self')
  return NextResponse.json({ success: true })
}
