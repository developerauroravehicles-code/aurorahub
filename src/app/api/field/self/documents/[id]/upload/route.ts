import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { fieldError, requireFieldSpecialist } from '@/lib/field/auth'
import { uploadAssignmentDocumentCore } from '@/lib/self/documents'

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/** POST /api/field/self/documents/:id/upload — multipart `file` for upload-type documents. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fieldError('Invalid form data', 400)
  }
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return fieldError('File required', 400)
  if (file.size > MAX_UPLOAD_BYTES) return fieldError('File must be 15 MB or smaller', 422)

  const { id } = await context.params
  const result = await uploadAssignmentDocumentCore(ctx.supabase, ctx.user.id, id, {
    buffer: Buffer.from(await file.arrayBuffer()),
    name: file.name,
    type: file.type,
  })
  if ('error' in result) return fieldError(result.error, 422)

  revalidatePath('/dashboard/self')
  revalidatePath('/dashboard/hr/compliance')
  return NextResponse.json({ success: true })
}
