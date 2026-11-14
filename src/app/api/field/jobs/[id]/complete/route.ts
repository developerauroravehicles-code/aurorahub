import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { fieldError, readJson, requireFieldSpecialist } from '@/lib/field/auth'
import { evaluateProof } from '@/lib/field/geo'
import { completeJobSchema, isOwnPhotoPath } from '@/lib/field/schemas'
import {
  completeDemandCore,
  COMPLETE_DEMAND_REVALIDATE_PATHS,
} from '@/lib/demands/complete-demand'

/**
 * POST /api/field/jobs/:id/complete — finish proof + the same completion
 * flow as the web "Complete" button (VIN check, barcode stock consumption,
 * pricing, daily invoice batch, webhooks).
 *
 * Safe against retries/double taps: the visit row is claimed atomically
 * before completion, and already-completed jobs are rejected, so barcodes
 * are never consumed twice.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx
  const { id: demandId } = await context.params

  const parsed = completeJobSchema.safeParse(await readJson(request))
  if (!parsed.success) return fieldError('Invalid completion data', 400)
  const input = parsed.data

  const { data: demand } = await ctx.supabase
    .from('demands')
    .select('status, assigned_specialist_id')
    .eq('id', demandId)
    .single()
  if (!demand) return fieldError('Work not found', 404)
  if (demand.status === 'completed') {
    return NextResponse.json({ error: 'This job is already completed', alreadyCompleted: true }, { status: 409 })
  }
  if (demand.status !== 'approved') return fieldError('Only approved work can be completed', 409)
  if (demand.assigned_specialist_id !== ctx.user.id) {
    return fieldError('You can only complete work assigned to you', 403)
  }

  const { data: visit } = await ctx.supabase
    .from('field_visits')
    .select('id, address_lat, address_lng, finished_at')
    .eq('demand_id', demandId)
    .eq('specialist_id', ctx.user.id)
    .maybeSingle()
  if (!visit) return fieldError('Start the job before completing it', 409)
  if (visit.finished_at) {
    return NextResponse.json({ error: 'This job is already completed', alreadyCompleted: true }, { status: 409 })
  }

  const photoPaths = input.photoPaths ?? []
  if (photoPaths.some((p) => !isOwnPhotoPath(p, ctx.user.id, demandId))) {
    return fieldError('Invalid photo path', 400)
  }

  const address =
    input.addressLocation ??
    (visit.address_lat != null && visit.address_lng != null
      ? { lat: visit.address_lat, lng: visit.address_lng }
      : null)
  const proof = evaluateProof(input.location, address)
  const reason = input.reason?.trim() || null
  if (proof.suspicious && !reason) {
    return NextResponse.json(
      {
        error: 'You are not at the job address. Enter a reason to finish anyway.',
        reasonRequired: true,
        distanceM: proof.distanceM,
      },
      { status: 422 }
    )
  }

  // Atomic claim: only one concurrent request can proceed to completion.
  const admin = createAdminClient()
  const { data: claimed, error: claimError } = await admin
    .from('field_visits')
    .update({ finish_claimed_at: new Date().toISOString() })
    .eq('id', visit.id)
    .is('finish_claimed_at', null)
    .is('finished_at', null)
    .select('id')
  if (claimError) return fieldError(claimError.message, 500)
  if (!claimed || claimed.length === 0) {
    return fieldError('This job is already being completed', 409)
  }

  const result = await completeDemandCore(ctx.supabase, ctx.user.id, demandId, {
    serviceType: input.serviceType,
    vinLast6: input.vinLast6,
    delayFeeTier: input.delayFeeTier,
    barcodeCodes: input.barcodeCodes,
  })
  if ('error' in result) {
    // Release the claim so the technician can fix the input (e.g. VIN) and retry.
    await admin.from('field_visits').update({ finish_claimed_at: null }).eq('id', visit.id)
    return fieldError(result.error, 422)
  }
  for (const path of COMPLETE_DEMAND_REVALIDATE_PATHS) revalidatePath(path)

  const { error: proofError } = await admin
    .from('field_visits')
    .update({
      finished_at: new Date().toISOString(), // replaced by now() in the DB trigger
      finish_lat: input.location.lat,
      finish_lng: input.location.lng,
      finish_accuracy_m: input.location.accuracyM ?? null,
      finish_distance_m: proof.distanceM,
      finish_suspicious: proof.suspicious,
      finish_reason: reason,
      photo_paths: photoPaths,
      barcode_codes: (input.barcodeCodes ?? []).map((c) => c.toUpperCase()),
    })
    .eq('id', visit.id)

  // The job itself is completed at this point; a failed proof write must not
  // make the app retry the completion, so report it as a warning.
  if (proofError) console.error('field_visits finish update failed:', proofError)

  return NextResponse.json({
    success: true,
    proofSaved: !proofError,
  })
}
