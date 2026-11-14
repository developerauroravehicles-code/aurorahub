import { NextResponse } from 'next/server'
import { requireFieldSpecialist } from '@/lib/field/auth'
import { isBarcodeModeEnabled } from '@/lib/inventory-barcodes'

/** GET /api/field/me — signed-in specialist and field settings. */
export async function GET(request: Request) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  const barcodeModeEnabled = await isBarcodeModeEnabled(ctx.supabase)
  return NextResponse.json({
    id: ctx.profile.id,
    fullName: ctx.profile.full_name,
    role: ctx.profile.role,
    barcodeModeEnabled,
  })
}
