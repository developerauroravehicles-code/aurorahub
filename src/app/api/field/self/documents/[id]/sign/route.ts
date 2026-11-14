import { NextResponse } from 'next/server'
import { fieldError, requireFieldSpecialist } from '@/lib/field/auth'
import { getEmbeddedSigningUrlForUser } from '@/app/dashboard/hr/compliance/document-pack-actions'

/**
 * POST /api/field/self/documents/:id/sign — DocuSign embedded signing URL. The app
 * opens it in the in-app browser; DocuSign returns to a simple "done" page.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  const { id } = await context.params
  const returnUrl = `${new URL(request.url).origin}/api/field/docusign-return`
  const result = await getEmbeddedSigningUrlForUser(ctx.supabase, ctx.user.id, id, returnUrl)
  if (result.error) return fieldError(result.error, 422)
  if (!('url' in result) || !result.url) return fieldError('Signing session not available', 422)
  return NextResponse.json({ url: result.url })
}
