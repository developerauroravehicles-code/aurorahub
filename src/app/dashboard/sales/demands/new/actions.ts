'use server'

import { createClient } from '@/lib/supabase/server'
import { logDemandChange } from '@/lib/demand-logger'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'
import { z } from 'zod'
import { parseVinDecodeWarningFromForm } from '@/lib/vin-decode/form-warning'
import { validateAppointmentSlot, getPoolSlotContext } from '@/app/dashboard/system-management/calendar/actions'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { validateDealerBookingCamera } from '@/lib/dealer-camera-catalog'
import { notifyAuroraManagersIfDuplicateStock } from '@/lib/notify-duplicate-stock'
import {
  isSlotAvailableForDealer,
} from '@/lib/scheduling-pool'
import { finalizeDemandAsApproved } from '@/lib/demands/finalize-demand-approved'
import {
  DEALER_HANDOFF_PLACEHOLDER_FIRST,
  DEALER_HANDOFF_PLACEHOLDER_LAST,
} from '@/lib/demand-dealer-handoff'
import { issuePortalTokenForDemand } from '@/lib/issue-portal-token-for-demand'
import { sendDealerHandoffLinkSms } from '@/lib/send-dealer-handoff-link-sms'

async function getDealerTimezone(dealerId: string | null): Promise<string | null> {
  if (!dealerId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('dealers')
    .select('region_codes(timezone_id, timezones(name))')
    .eq('id', dealerId)
    .single()
  return getTimezoneFromDealer(data as Parameters<typeof getTimezoneFromDealer>[0]) ?? null
}

const schema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().optional(),
  vehicleMake: z.string().min(1, 'Vehicle make is required'),
  vehicleModel: z.string().min(1, 'Vehicle model is required'),
  vehicleYear: z.coerce.number().min(1900, 'Vehicle year is required'),
  stockNumber: z
    .string()
    .optional()
    .transform(v => {
      const trimmed = (v ?? '').trim().toUpperCase()
      return trimmed.length > 0 ? trimmed : null
    }),
  vinLast6: z
    .string()
    .min(1, 'VIN is required')
    .transform(v => (v || '').trim().replace(/\s/g, '').slice(-6).toUpperCase())
    .refine(v => v.length >= 6, 'VIN last 6 digits are required'),
  cameraModel: z.string().min(1),
  appointmentDate: z.string().min(1, 'Please select a time slot'),
  comment: z.string().optional(),
})

export type DemandHandoffDemand = {
  id: string
  demand_number: number | null
  customer_firstname: string
  customer_lastname: string
  customer_phone: string
  customer_address: string | null
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  stock_number: string | null
  vin_last6: string | null
  camera_model: string | null
  appointment_date: string
  comment: string | null
  status: string
  created_at: string
}

export type CreateDemandState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | {
      success: true
      demand: DemandHandoffDemand
      dealer: { name: string; warranty_years: number | null }
      timezoneName: string | null
      role: 'sales' | 'finance'
      portalUrl: string | null
      smsSent: boolean
      smsError?: string
    }
  | null

export async function createDemand(prevState: CreateDemandState, formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('id, dealer_id, role').eq('id', user.id).single()
  if (!profile) return { error: 'Profile not found' }
  if (!['sales', 'finance'].includes(profile.role)) {
    return { error: 'Only sales and finance users can create demands' }
  }

  const rawData = {
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
  }

  const result = schema.safeParse(rawData)
  if (!result.success) {
      return { error: 'Validation failed', fieldErrors: result.error.flatten().fieldErrors }
  }

  const data = result.data

  if (!profile.dealer_id) {
    return { error: 'Your account is not assigned to a dealer.' }
  }

  const validation = await validateAppointmentSlot(profile.dealer_id, data.appointmentDate)
  if (!validation.valid) {
    return { error: validation.error ?? 'This time slot is not available.' }
  }

  const timezoneName = await getDealerTimezone(profile.dealer_id)
  const slotTaken = !(await isSlotAvailableForDealer(supabase, profile.dealer_id, data.appointmentDate))
  if (slotTaken) {
      return { error: 'This time slot is fully booked for your service area. Please select another time.' }
  }

  const cameraCheck = await validateDealerBookingCamera(supabase, profile.dealer_id, {
    cameraModelName: data.cameraModel,
  })
  if ('error' in cameraCheck) {
    return { error: cameraCheck.error }
  }

  const { data: dealerAddressRow } = await supabase
    .from('dealers')
    .select('name, address')
    .eq('id', profile.dealer_id)
    .single()

  const insertData = {
    created_by: profile.id,
    dealer_id: profile.dealer_id,
    customer_firstname: DEALER_HANDOFF_PLACEHOLDER_FIRST,
    customer_lastname: DEALER_HANDOFF_PLACEHOLDER_LAST,
    customer_phone: data.phone,
    customer_address: data.address || dealerAddressRow?.address || dealerAddressRow?.name || null,
    customer_details_pending: true,
    vehicle_make: data.vehicleMake,
    vehicle_model: data.vehicleModel,
    vehicle_year: data.vehicleYear,
    stock_number: data.stockNumber ?? null,
    vin_last6: data.vinLast6,
    vin_decode_warning: parseVinDecodeWarningFromForm(formData),
    camera_model: cameraCheck.cameraModelName,
    camera_model_id: cameraCheck.cameraModelId,
    appointment_date: data.appointmentDate,
    status: 'approved' as const,
    ...(profile.role === 'finance' && { assigned_finance_id: profile.id }),
    ...(data.comment && data.comment.trim() && { comment: data.comment.trim() }),
  }

  const { data: demand, error } = await supabase.from('demands').insert(insertData).select().single()

  if (error) {
      console.error('Demand creation error:', error)
      // Check if error is related to overlapping appointments
      if (error.message && (error.message.includes('time slot is already booked') || error.message.includes('fully booked'))) {
          return { error: 'This time slot is fully booked for your service area. Please select another time.' }
      }
      return { error: error.message || 'Failed to create demand. Please check your permissions.' }
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
    logNote: 'Demand created and approved; customer details pending portal',
    transitionFromStatus: null,
    sms: { customer: false, specialist: true, auroraManager: true },
  })

  if ('error' in finalized) {
    console.error('Auto-approve after create failed:', finalized.error)
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

  if (data.stockNumber) {
    notifyAuroraManagersIfDuplicateStock({
      demandId: demand.id,
      demandNumber: demand.demand_number,
      stockNumber: data.stockNumber,
    }).catch(() => {})
  }

  const { data: dealerRow } = await supabase
    .from('dealers')
    .select('name, warranty_years')
    .eq('id', profile.dealer_id)
    .single()

  const portal = await issuePortalTokenForDemand(data.phone, demand.id, profile.id)
  let smsSent = false
  let smsError: string | undefined
  if (portal?.url) {
    const sms = await sendDealerHandoffLinkSms(data.phone, portal.url, demand.id)
    smsSent = sms.success
    smsError = sms.error
  }

  return {
    success: true as const,
    demand: {
      id: demand.id,
      demand_number: demand.demand_number,
      customer_firstname: demand.customer_firstname,
      customer_lastname: demand.customer_lastname,
      customer_phone: demand.customer_phone,
      customer_address: demand.customer_address,
      vehicle_make: demand.vehicle_make,
      vehicle_model: demand.vehicle_model,
      vehicle_year: demand.vehicle_year,
      stock_number: demand.stock_number,
      vin_last6: demand.vin_last6,
      camera_model: demand.camera_model,
      appointment_date: demand.appointment_date,
      comment: demand.comment,
      status: demand.status,
      created_at: demand.created_at,
    },
    dealer: {
      name: dealerRow?.name ?? data.address ?? 'Dealer',
      warranty_years: dealerRow?.warranty_years ?? null,
    },
    timezoneName,
    role: profile.role as 'sales' | 'finance',
    portalUrl: portal?.url ?? null,
    smsSent,
    smsError,
  }
}

/**
 * Get appointment times in the dealer's scheduling pool on a date.
 * Pool-scoped: distant service areas do not block each other.
 */
export async function getTakenSlots(
  dateStr: string,
  dealerId?: string | null,
  _timezoneName?: string | null
) {
  if (!dealerId) return []
  const { appointments } = await getPoolSlotContext(dealerId, dateStr.slice(0, 10))
  return appointments
}

/**
 * Check if a specific slot is fully booked for the dealer's scheduling pool.
 */
export async function isSlotBlocked(slotDate: string, dealerId?: string | null): Promise<boolean> {
  if (!dealerId) return false
  const supabase = await createClient()
  return !(await isSlotAvailableForDealer(supabase, dealerId, slotDate))
}

/**
 * Check if a specific time slot is fully booked in the dealer's scheduling pool.
 */
export async function isTimeSlotTaken(
  appointmentDate: string,
  dealerId: string | null,
  _timezoneName?: string | null
): Promise<boolean> {
  if (!dealerId) return false
  const supabase = await createClient()
  return !(await isSlotAvailableForDealer(supabase, dealerId, appointmentDate))
}

