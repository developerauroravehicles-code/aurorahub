'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { validateAppointmentSlot, getPoolSlotContext } from '@/app/dashboard/system-management/calendar/actions'
import { validateDealerBookingCamera } from '@/lib/dealer-camera-catalog'
import { notifyAuroraManagersIfDuplicateStock } from '@/lib/notify-duplicate-stock'
import { isSlotAvailableForDealer } from '@/lib/scheduling-pool'
import { finalizeDemandAsApproved } from '@/lib/demands/finalize-demand-approved'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'
import { issuePortalTokenForDemand } from '@/lib/issue-portal-token-for-demand'
import { sendDealerHandoffLinkSms } from '@/lib/send-dealer-handoff-link-sms'

const PLACEHOLDER_FIRST = 'PENDING'
const PLACEHOLDER_LAST = 'CUSTOMER'

const schema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  stockNumber: z.string().min(1, 'Stock number is required').transform(v => v.trim().toUpperCase()),
  vinLast6: z
    .string()
    .min(1, 'VIN is required')
    .transform(v => v.trim().replace(/\s/g, '').slice(-6).toUpperCase())
    .refine(v => v.length >= 6, 'Enter at least the last 6 characters of the VIN'),
  vehicleMake: z.string().min(1, 'Vehicle make is required (decode VIN first)'),
  vehicleModel: z.string().min(1, 'Vehicle model is required'),
  vehicleYear: z.coerce.number().min(1900, 'Vehicle year is required'),
  cameraModel: z.string().min(1, 'Camera model is required'),
  appointmentDate: z.string().min(1, 'Please select a time slot'),
  comment: z.string().optional(),
})

export type CreateQuickDemandState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | {
      success: true
      demandNumber: number | null
      portalUrl: string | null
      smsSent: boolean
      smsError?: string
    }
  | null

export async function createQuickDealerDemand(
  prevState: CreateQuickDemandState,
  formData: FormData
): Promise<CreateQuickDemandState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('id, dealer_id, role').eq('id', user.id).single()
  if (!profile) return { error: 'Profile not found' }
  if (!['sales', 'finance'].includes(profile.role ?? '')) {
    return { error: 'Only sales and finance users can create appointments' }
  }
  if (!profile.dealer_id) return { error: 'Your account is not assigned to a dealer.' }

  const raw = {
    phone: formData.get('phone'),
    stockNumber: formData.get('stockNumber'),
    vinLast6: formData.get('vinLast6'),
    vehicleMake: formData.get('vehicleMake'),
    vehicleModel: formData.get('vehicleModel'),
    vehicleYear: formData.get('vehicleYear'),
    cameraModel: formData.get('cameraModel'),
    appointmentDate: formData.get('appointmentDate'),
    comment: formData.get('comment'),
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data

  const validation = await validateAppointmentSlot(profile.dealer_id, data.appointmentDate)
  if (!validation.valid) {
    return { error: validation.error ?? 'This time slot is not available.' }
  }

  const slotTaken = !(await isSlotAvailableForDealer(supabase, profile.dealer_id, data.appointmentDate))
  if (slotTaken) {
    return { error: 'This time slot is fully booked. Please select another time.' }
  }

  const cameraCheck = await validateDealerBookingCamera(supabase, profile.dealer_id, {
    cameraModelName: data.cameraModel,
  })
  if ('error' in cameraCheck) {
    return { error: cameraCheck.error }
  }

  const { data: dealerRow } = await supabase
    .from('dealers')
    .select('name, address')
    .eq('id', profile.dealer_id)
    .single()

  const insertData = {
    created_by: profile.id,
    dealer_id: profile.dealer_id,
    customer_firstname: PLACEHOLDER_FIRST,
    customer_lastname: PLACEHOLDER_LAST,
    customer_phone: data.phone,
    customer_address: dealerRow?.address ?? dealerRow?.name ?? null,
    vehicle_make: data.vehicleMake,
    vehicle_model: data.vehicleModel,
    vehicle_year: data.vehicleYear,
    stock_number: data.stockNumber,
    vin_last6: data.vinLast6,
    camera_model: cameraCheck.cameraModelName,
    camera_model_id: cameraCheck.cameraModelId,
    appointment_date: data.appointmentDate,
    status: 'approved' as const,
    customer_details_pending: true,
    ...(profile.role === 'finance' && { assigned_finance_id: profile.id }),
    ...(data.comment?.trim() && { comment: data.comment.trim() }),
  }

  const { data: demand, error } = await supabase.from('demands').insert(insertData).select().single()
  if (error) {
    if (error.message?.includes('fully booked') || error.message?.includes('time slot')) {
      return { error: 'This time slot is fully booked. Please select another time.' }
    }
    return { error: error.message || 'Failed to create appointment' }
  }

  const finalized = await finalizeDemandAsApproved(supabase, {
    demandId: demand.id,
    actorId: user.id,
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
    logNote: 'Quick dealer appointment; customer details pending',
    transitionFromStatus: null,
    sms: { customer: false, specialist: true, auroraManager: true },
  })

  if ('error' in finalized) {
    console.error('Quick demand finalize failed:', finalized.error)
  }

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
  }).catch(() => {})

  const portal = await issuePortalTokenForDemand(data.phone, demand.id, profile.id)
  let smsSent = false
  let smsError: string | undefined
  if (portal?.url) {
    const sms = await sendDealerHandoffLinkSms(data.phone, portal.url, demand.id)
    smsSent = sms.success
    smsError = sms.error
  }

  return {
    success: true,
    demandNumber: demand.demand_number,
    portalUrl: portal?.url ?? null,
    smsSent,
    smsError,
  }
}