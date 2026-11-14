import { NextResponse } from 'next/server'
import { fieldError, requireFieldSpecialist } from '@/lib/field/auth'
import { loadSelfPortalData } from '@/lib/self/load-self-portal'
import { getSelfPersonnelId } from '@/lib/self/documents'
import { preparePendingAssignmentsForUser } from '@/app/dashboard/hr/compliance/document-pack-actions'

/** GET /api/field/self — everything the web Self Portal shows, for the signed-in specialist. */
export async function GET(request: Request) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx
  if (ctx.profile.dealer_id) return fieldError('Self Portal is only for platform users', 403)

  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('id, full_name, phone, role, dealer_id')
    .eq('id', ctx.user.id)
    .single()
  if (!profile) return fieldError('Profile not found', 404)

  // Same as the web page: generate assigned documents before listing them.
  const personnelId = await getSelfPersonnelId(ctx.supabase, ctx.user.id)
  if (personnelId) {
    await preparePendingAssignmentsForUser(ctx.supabase, ctx.user.id, personnelId)
  }

  const data = await loadSelfPortalData(ctx.supabase, profile)
  return NextResponse.json(data)
}
