'use server'

import { createClient } from '@/lib/supabase/server'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ptDatetimeLocalToISO } from '@/lib/timezone-defaults'
import { validateDealerBookingCamera } from '@/lib/dealer-camera-catalog'
import { notifyAuroraManagersIfDuplicateStock } from '@/lib/notify-duplicate-stock'
import { finalizeDemandAsApproved } from '@/lib/demands/finalize-demand-approved'
import { getIndividualSalesDealerIdOrThrow } from '@/lib/individual-sales'
import { INDIVIDUAL_SALES_DEMANDS } from '@/lib/individual-sales'

const schema = z.object({
  firstName: z.string().min(1).transform((v) => (v || '').trim().toUpperCase()),
  lastName: z.string().min(1).transform((v) => (v || '').trim().toUpperCase()),
  phone: z.string().min(1),
  address: z.string().optional(),
  vehicleMake: z.string().min(1),
  vehicleModel: z.string().min(1),
  vehicleYear: z.coerce.number().min(1900),
  stockNumber: z
    .string()
    .optional()
    .transform((v) => {
      const trimmed = (v ?? '').trim().toUpperCase()
      return trimmed.length > 0 ? trimmed : null
    }),
  vinLast6: z
    .string()
    .min(1)
    .transform((v) => (v || '').trim().replace(/\s/g, '').slice(-6).toUpperCase())
    .refine((v) => v.length >= 6, 'VIN last 6 digits required'),
  cameraModel: z.string().min(1),
  appointmentAtLocal: z.string().min(1, 'Choose appointment date and time'),
  comment: z.string().optional(),
  assignedSpecialistId: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
})

export type CreateIndividualDemandState = {
  error?: string
  success?: boolean
  fieldErrors?: Record<string, string[]>
  demandId?: string
} | null

async function requireAuroraManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }

  const { data: profile } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Managers can create individual sales appointments' as const }
  }
  return { supabase, user, profile }
}

export async function createIndividualDemand(
  _prev: CreateIndividualDemandState,
  formData: FormData
): Promise<CreateIndividualDemandState> {
  const auth = await requireAuroraManager()
  if ('error' in auth) return { error: auth.error }

  const raw = {
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
    appointmentAtLocal: formData.get('appointmentAtLocal'),
    comment: formData.get('comment'),
    assignedSpecialistId: formData.get('assignedSpecialistId'),
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const data = parsed.data
  let appointmentIso: string
  try {
    appointmentIso = ptDatetimeLocalToISO(data.appointmentAtLocal.trim())
  } catch {
    return { error: 'Invalid appointment date and time.' }
  }

  const appointmentAt = new Date(appointmentIso)
  if (Number.isNaN(appointmentAt.getTime())) {
    return { error: 'Invalid appointment date and time.' }
  }
  if (appointmentAt.getTime() < Date.now() - 60_000) {
    return { error: 'Appointment time is in the past.' }
  }

  let dealerId: string
  try {
    dealerId = await getIndividualSalesDealerIdOrThrow(auth.supabase)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Individual Sales is not configured.' }
  }

  const cameraCheck = await validateDealerBookingCamera(auth.supabase, dealerId, {
    cameraModelName: data.cameraModel,
  })
  if ('error' in cameraCheck) {
    return { error: cameraCheck.error }
  }

  const { data: dealerRow } = await auth.supabase
    .from('dealers')
    .select('name, address')
    .eq('id', dealerId)
    .single()

  const insertData = {
    created_by: auth.profile.id,
    dealer_id: dealerId,
    customer_firstname: data.firstName,
    customer_lastname: data.lastName,
    customer_phone: data.phone,
    customer_address: data.address?.trim() || dealerRow?.address || dealerRow?.name || null,
    customer_details_pending: false,
    vehicle_make: data.vehicleMake,
    vehicle_model: data.vehicleModel,
    vehicle_year: data.vehicleYear,
    stock_number: data.stockNumber,
    vin_last6: data.vinLast6,
    camera_model: cameraCheck.cameraModelName,
    camera_model_id: cameraCheck.cameraModelId,
    appointment_date: appointmentIso,
    status: 'approved' as const,
    is_individual: true,
    is_external: false,
    ...(data.assignedSpecialistId && { assigned_specialist_id: data.assignedSpecialistId }),
    ...(data.comment?.trim() && { comment: data.comment.trim() }),
  }

  const { data: demand, error } = await auth.supabase.from('demands').insert(insertData).select().single()

  if (error) {
    if (error.message?.includes('time slot is already booked')) {
      return { error: 'This time conflicts with another appointment at the same dealer.' }
    }
    return { error: error.message || 'Failed to create appointment.' }
  }

  const finalized = await finalizeDemandAsApproved(auth.supabase, {
    demandId: demand.id,
    actorId: auth.user.id,
    demand: {
      dealer_id: demand.dealer_id,
      customer_phone: demand.customer_phone,
      customer_firstname: demand.customer_firstname,
      customer_lastname: demand.customer_lastname,
      appointment_date: demand.appointment_date,
      customer_address: demand.customer_address,
      vehicle_year: demand.vehicle_year,
      vehicle_make: demand.vehicle_make,
      vehicle_model: demand.vehicle_model,
      vin_last6: demand.vin_last6,
      stock_number: demand.stock_number,
      assigned_specialist_id: demand.assigned_specialist_id,
    },
    previousStatus: null,
    logNote: 'Individual sales appointment created',
    transitionFromStatus: null,
  })

  if ('error' in finalized) {
    console.error('Individual demand finalize failed:', finalized.error)
  }

  dispatchWebhooks(auth.supabase, 'demand_created', {
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

  if (data.stockNumber) {
    notifyAuroraManagersIfDuplicateStock({
      demandId: demand.id,
      demandNumber: demand.demand_number,
      stockNumber: data.stockNumber,
    }).catch(() => {})
  }

  revalidatePath(INDIVIDUAL_SALES_DEMANDS)
  return { success: true, demandId: demand.id }
}