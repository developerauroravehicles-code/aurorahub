import { NextResponse } from 'next/server'
import { fieldError, readJson, requireFieldSpecialist } from '@/lib/field/auth'
import { evaluateProof } from '@/lib/field/geo'
import { startJobSchema } from '@/lib/field/schemas'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/field/jobs/:id/start — records the start-of-job location proof.
 * Never blocks: a far/unknown location only requires a reason and is flagged.
 * Idempotent: a second call returns the existing visit.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx
  const { id: demandId } = await context.params

  const parsed = startJobSchema.safeParse(await readJson(request))
  if (!parsed.success) return fieldError('Invalid location data', 400)
  const input = parsed.data

  const { data: demand } = await ctx.supabase
    .from('demands')
    .select('id, status, assigned_specialist_id')
    .eq('id', demandId)
    .single()
  if (!demand) return fieldError('Work not found', 404)
  if (demand.assigned_specialist_id !== ctx.user.id) {
    return fieldError('You can only start work assigned to you', 403)
  }
  if (demand.status !== 'approved') return fieldError('Only approved work can be started', 409)

  const { data: existing } = await ctx.supabase
    .from('field_visits')
    .select('*')
    .eq('demand_id', demandId)
    .eq('specialist_id', ctx.user.id)
    .maybeSingle()
  if (existing) return NextResponse.json({ visit: existing, alreadyStarted: true })

  const proof = evaluateProof(input.location, input.addressLocation ?? null)
  const reason = input.reason?.trim() || null
  if (proof.suspicious && !reason) {
    return NextResponse.json(
      {
        error: 'You are not at the job address. Enter a reason to start anyway.',
        reasonRequired: true,
        distanceM: proof.distanceM,
      },
      { status: 422 }
    )
  }

  // Specialists cannot write field_visits directly (RLS); the API writes after
  // the checks above. started_at is set by the DB trigger.
  const admin = createAdminClient()
  const { data: visit, error } = await admin
    .from('field_visits')
    .insert({
      demand_id: demandId,
      specialist_id: ctx.user.id,
      address_lat: input.addressLocation?.lat ?? null,
      address_lng: input.addressLocation?.lng ?? null,
      start_lat: input.location.lat,
      start_lng: input.location.lng,
      start_accuracy_m: input.location.accuracyM ?? null,
      start_distance_m: proof.distanceM,
      start_suspicious: proof.suspicious,
      start_reason: reason,
    })
    .select('*')
    .single()

  if (error) {
    // Concurrent double tap: the other request created the visit first.
    if (error.code === '23505') {
      const { data: raced } = await ctx.supabase
        .from('field_visits')
        .select('*')
        .eq('demand_id', demandId)
        .eq('specialist_id', ctx.user.id)
        .maybeSingle()
      if (raced) return NextResponse.json({ visit: raced, alreadyStarted: true })
    }
    return fieldError(error.message, 500)
  }
  return NextResponse.json({ visit, alreadyStarted: false }, { status: 201 })
}
