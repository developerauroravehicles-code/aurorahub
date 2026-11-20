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
import { after } from 'next/server'
import { normalizeVinInput, validateVinFormat } from '@/lib/vin-decode/nhtsa-vpic'
import { modelYearHintFromVin } from '@/lib/vin-decode/vin-model-year'
import { applyVinDecodeToDemand } from '@/lib/vin-decode/apply-vin-decode-to-demand'

const PENDING_VEHICLE_LABEL = 'Pending VIN decode'

const schema = z.object({
  firstName: z.string().min(1).transform((v) => (v || '').trim().toUpperCase()),
  lastName: z.string().min(1).transform((v) => (v || '').trim().toUpperCase()),
  phone: z.string().min(1),
  address: z.string().optional(),
  fullVin: z
    .string()
    .min(1)
    .transform((v) => normalizeVinInput(v))
    .refine((v) => v.length === 17, 'Enter the full 17-character VIN'),
  stockNumber: z
    .string()
    .optional()
    .transform((v) => {
      const trimmed = (v ?? '').trim().toUpperCase()
      return trimmed.length > 0 ? trimmed : null
    }),
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
    fullVin: formData.get('fullVin'),
    stockNumber: formData.get('stockNumber'),
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
  const vinValidated = validateVinFormat(data.fullVin)
  if ('error' in vinValidated) {
    return { error: vinValidated.error }
  }
  const fullVin = vinValidated.vin
  const vinLast6 = fullVin.slice(-6)
  const vehicleYear = modelYearHintFromVin(fullVin) ?? new Date().getFullYear()

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
    vehicle_make: PENDING_VEHICLE_LABEL,
    vehicle_model: PENDING_VEHICLE_LABEL,
    vehicle_year: vehicleYear,
    stock_number: data.stockNumber,
    vin_last6: vinLast6,
    vin_decode_warning: true,
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

  const actorId = auth.user.id

  after(async () => {
    const bg = await createClient()
    const decoded = await applyVinDecodeToDemand(bg, demand.id, fullVin)
    const vehicleForNotify =
      'ok' in decoded && decoded.ok
        ? {
            vehicle_year: decoded.vehicle_year,
            vehicle_make: decoded.vehicle_make,
            vehicle_model: decoded.vehicle_model,
            vin_last6: decoded.vin_last6,
          }
        : {
            vehicle_year: demand.vehicle_year,
            vehicle_make: demand.vehicle_make,
            vehicle_model: demand.vehicle_model,
            vin_last6: decoded.vin_last6,
          }

    const finalized = await finalizeDemandAsApproved(bg, {
      demandId: demand.id,
      actorId,
      demand: {
        dealer_id: demand.dealer_id,
        customer_phone: demand.customer_phone,
        customer_firstname: demand.customer_firstname,
        customer_lastname: demand.customer_lastname,
        appointment_date: demand.appointment_date,
        customer_address: demand.customer_address,
        vehicle_year: vehicleForNotify.vehicle_year,
        vehicle_make: vehicleForNotify.vehicle_make,
        vehicle_model: vehicleForNotify.vehicle_model,
        vin_last6: vehicleForNotify.vin_last6,
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

    dispatchWebhooks(bg, 'demand_created', {
      demand_id: demand.id,
      demand_number: demand.demand_number,
      status: demand.status,
      customer_firstname: demand.customer_firstname,
      customer_lastname: demand.customer_lastname,
      vehicle_make: vehicleForNotify.vehicle_make,
      vehicle_model: vehicleForNotify.vehicle_model,
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
  })

  revalidatePath(INDIVIDUAL_SALES_DEMANDS)
  return { success: true, demandId: demand.id }
}