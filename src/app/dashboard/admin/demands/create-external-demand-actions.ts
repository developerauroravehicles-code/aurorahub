'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logDemandChange } from '@/lib/demand-logger'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { wallDateToAppointmentIso } from '@/lib/external-demand-date'
import { lookupCameraModelId } from '@/lib/camera-model-resolve'
import {
  calculateDemandInvoiceAmount,
  DemandServiceType,
  isDemandServiceType,
} from '@/lib/demand-pricing'
import { addDemandToDailyBatch } from '@/lib/daily-dealer-invoices'
import { notifyAuroraManagersIfDuplicateStock } from '@/lib/notify-duplicate-stock'

const schema = z.object({
  dealerId: z.string().min(1, 'Dealer is required'),
  firstName: z.string().min(1).transform(v => (v || '').trim().toUpperCase()),
  lastName: z.string().min(1).transform(v => (v || '').trim().toUpperCase()),
  phone: z.string().min(1),
  address: z.string().optional(),
  vehicleMake: z.string().min(1),
  vehicleModel: z.string().min(1),
  vehicleYear: z.coerce.number().min(1900),
  stockNumber: z.string().min(1, 'Stock number is required').transform(v => (v || '').trim().toUpperCase()),
  vinLast6: z.string().min(1, 'VIN last 6 digits is required').refine(
    v => (v || '').trim().replace(/\s/g, '').length >= 6,
    'VIN last 6 digits is required (at least 6 characters)'
  ).transform(v => (v || '').trim().replace(/\s/g, '').slice(-6).toUpperCase()),
  cameraModel: z.string().min(1),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a date'),
  comment: z.string().optional(),
  assignedSpecialistId: z.string().optional().transform(v => (v && v.trim() ? v.trim() : undefined)),
})

export type CreateExternalDemandState = { error?: string; success?: boolean; fieldErrors?: Record<string, string[]> } | null

export async function createExternalDemand(prevState: CreateExternalDemandState, formData: FormData): Promise<CreateExternalDemandState> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Managers can create external demands' }
  }

  const rawData = {
    dealerId: formData.get('dealerId'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    vehicleMake: formData.get('vehicleMake'),
    vehicleModel: formData.get('vehicleModel'),
    vehicleYear: formData.get('vehicleYear'),
    stockNumber: formData.get('stockNumber'),
    vinLast6: formData.get('vinLast6'),
    cameraModel: formData.get('cameraModel'),
    appointmentDate: formData.get('appointmentDate'),
    comment: formData.get('comment'),
    assignedSpecialistId: formData.get('assignedSpecialistId'),
  }

  const result = schema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Validation failed', fieldErrors: result.error.flatten().fieldErrors }
  }

  const data = result.data

  // Calendar date is a business day for the dealer: store as 12:00 in that dealer's timezone (fallback: Pacific).
  // Use toDate(...) so server TZ (often UTC) does not skew fromZonedTime(new Date(y,m,d,...)).
  const { data: dealerRow } = await supabase
    .from('dealers')
    .select('region_codes(timezone_id, timezones(name))')
    .eq('id', data.dealerId)
    .single()

  const tz = getTimezoneFromDealer(dealerRow as Parameters<typeof getTimezoneFromDealer>[0])
  let appointmentDateISO: string
  try {
    appointmentDateISO = wallDateToAppointmentIso(data.appointmentDate, tz ?? 'America/Vancouver')
  } catch {
    return { error: 'Invalid appointment date' }
  }

  const completeOnCreate = formData.get('completeOnCreate') === 'true'
  const serviceTypeRaw = completeOnCreate ? String(formData.get('serviceType') ?? '').trim() : ''
  if (completeOnCreate && !isDemandServiceType(serviceTypeRaw)) {
    return { error: 'Service type is required when marking as completed on creation.' }
  }
  const serviceType = completeOnCreate ? (serviceTypeRaw as DemandServiceType) : null

  const cameraModelId = await lookupCameraModelId(supabase, data.cameraModel)

  let invoiceTotalAmount: number | undefined
  if (completeOnCreate && serviceType) {
    const pricingResult = await calculateDemandInvoiceAmount(supabase, {
      dealerId: data.dealerId,
      cameraModelId,
      cameraModelName: data.cameraModel,
      serviceType,
    })
    if ('error' in pricingResult) {
      return { error: pricingResult.error }
    }
    invoiceTotalAmount = pricingResult.amount
  }

  const insertData = {
    created_by: profile.id,
    dealer_id: data.dealerId,
    customer_firstname: data.firstName,
    customer_lastname: data.lastName,
    customer_phone: data.phone,
    customer_address: data.address || null,
    vehicle_make: data.vehicleMake,
    vehicle_model: data.vehicleModel,
    vehicle_year: data.vehicleYear,
    stock_number: data.stockNumber,
    vin_last6: data.vinLast6,
    camera_model: data.cameraModel,
    ...(cameraModelId && { camera_model_id: cameraModelId }),
    appointment_date: appointmentDateISO,
    status: completeOnCreate ? 'completed' : 'pending_finance',
    // Statement / reporting use completed_at for month filters — must match the retroactive job date, not "now"
    ...(completeOnCreate && { completed_at: appointmentDateISO }),
    ...(completeOnCreate && serviceType && { service_type: serviceType }),
    ...(completeOnCreate && invoiceTotalAmount != null && { invoice_total_amount: invoiceTotalAmount }),
    is_external: true,
    ...(data.comment?.trim() && { comment: data.comment.trim() }),
    ...(data.assignedSpecialistId && { assigned_specialist_id: data.assignedSpecialistId }),
  }

  const { data: demand, error } = await supabase.from('demands').insert(insertData).select().single()

  if (error) {
    console.error('External demand creation error:', error)
    return { error: error.message || 'Failed to create demand.' }
  }

  if (completeOnCreate) {
    const admin = createAdminClient()
    addDemandToDailyBatch(admin, demand.id).catch(() => {})
  }

  logDemandChange({
    demandId: demand.id,
    actorId: user.id,
    previousStatus: null,
    newStatus: demand.status,
    notes: completeOnCreate ? 'External demand created and marked completed by Aurora Manager' : 'External demand created by Aurora Manager',
  }).catch(() => {})

  dispatchWebhooks(supabase, 'demand_created', {
    demand_id: demand.id,
    demand_number: demand.demand_number,
    status: demand.status,
    customer_firstname: demand.customer_firstname,
    customer_lastname: demand.customer_lastname,
    vehicle_make: demand.vehicle_make,
    vehicle_model: demand.vehicle_model,
    appointment_date: demand.appointment_date,
    dealer_id: demand.dealer_id,
  }).catch(() => {})

  notifyAuroraManagersIfDuplicateStock({
    demandId: demand.id,
    demandNumber: demand.demand_number,
    stockNumber: data.stockNumber,
    dealerId: data.dealerId,
  }).catch(() => {})

  revalidatePath('/dashboard/admin/demands')
  revalidatePath('/dashboard/admin/invoices')
  revalidatePath('/dashboard/admin/daily-invoices')
  return { success: true }
}
