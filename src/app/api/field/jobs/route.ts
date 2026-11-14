import { NextResponse } from 'next/server'
import { fieldError, requireFieldSpecialist } from '@/lib/field/auth'

const JOB_COLUMNS =
  'id, demand_number, status, service_type, appointment_date, customer_firstname, customer_lastname, customer_phone, customer_address, vehicle_make, vehicle_model, vehicle_year, camera_model, stock_number, comment, dealers(name)'

/**
 * GET /api/field/jobs — approved jobs assigned to the signed-in specialist
 * (including overdue ones), with their field-visit state.
 * VIN is intentionally not returned: the technician must read it off the car.
 */
export async function GET(request: Request) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  const { data: jobs, error } = await ctx.supabase
    .from('demands')
    .select(JOB_COLUMNS)
    .eq('assigned_specialist_id', ctx.user.id)
    .eq('status', 'approved')
    .order('appointment_date', { ascending: true })
    .limit(200)

  if (error) return fieldError(error.message, 500)

  const ids = (jobs ?? []).map((j) => j.id)
  const visitsByDemand = new Map<string, { started_at: string; finished_at: string | null }>()
  if (ids.length > 0) {
    const { data: visits, error: visitsError } = await ctx.supabase
      .from('field_visits')
      .select('demand_id, started_at, finished_at')
      .eq('specialist_id', ctx.user.id)
      .in('demand_id', ids)
    if (visitsError) return fieldError(visitsError.message, 500)
    for (const v of visits ?? []) visitsByDemand.set(v.demand_id, v)
  }

  return NextResponse.json({
    jobs: (jobs ?? []).map((job) => ({
      ...job,
      visit: visitsByDemand.get(job.id) ?? null,
    })),
  })
}
