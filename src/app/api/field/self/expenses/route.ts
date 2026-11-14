import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { fieldError, requireFieldSpecialist } from '@/lib/field/auth'
import {
  expenseAccessError,
  expenseRevalidatePaths,
  RECEIPT_MAX_BYTES,
  submitExpenseClaimCore,
} from '@/lib/self/expenses'

/**
 * POST /api/field/self/expenses — multipart form with the same fields as the Self
 * Portal: description, expense_date, category, amount | duty_hours + duty_minutes, receipt.
 */
export async function POST(request: Request) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  const accessError = expenseAccessError(ctx.profile)
  if (accessError) return fieldError(accessError, 403)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fieldError('Invalid form data', 400)
  }

  const receipt = form.get('receipt')
  if (receipt instanceof File && receipt.size > RECEIPT_MAX_BYTES) {
    return fieldError('Receipt must be 8 MB or smaller.', 422)
  }

  const result = await submitExpenseClaimCore(ctx.supabase, ctx.profile, {
    description: String(form.get('description') ?? ''),
    expenseDate: String(form.get('expense_date') ?? ''),
    category: String(form.get('category') ?? 'travel'),
    amount: String(form.get('amount') ?? ''),
    dutyHours: String(form.get('duty_hours') ?? '0'),
    dutyMinutes: String(form.get('duty_minutes') ?? '0'),
    receipt:
      receipt instanceof File && receipt.size > 0
        ? {
            buffer: Buffer.from(await receipt.arrayBuffer()),
            mimeType: receipt.type,
            fileName: receipt.name,
            size: receipt.size,
          }
        : null,
  })
  if ('error' in result) return fieldError(result.error, 422)

  for (const path of expenseRevalidatePaths(ctx.user.id)) revalidatePath(path)
  return NextResponse.json({ success: true })
}
