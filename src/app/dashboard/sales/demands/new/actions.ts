'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logDemandChange } from '@/lib/demand-logger'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'
import { z } from 'zod'
import { normalizeVinInput, validateVinFormat } from '@/lib/vin-decode/nhtsa-vpic'
import { modelYearHintFromVin } from '@/lib/vin-decode/vin-model-year'
import { applyVinDecodeToDemand } from '@/lib/vin-decode/apply-vin-decode-to-demand'
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

const PENDING_VEHICLE_LABEL = 'Pending VIN decode'

const schema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().optional(),
  fullVin: z
    .string()
    .min(1, 'Full VIN is required')
    .transform((v) => normalizeVinInput(v))
    .refine((v) => v.length === 17, 'Enter the full 17-character VIN'),
  stockNumber: z
    .string()
    .optional()
    .transform(v => {
      const trimmed = (v ?? '').trim().toUpperCase()
      return trimmed.length > 0 ? trimmed : null
    }),
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
      smsQueued?: boolean
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
    fullVin: formData.get('fullVin'),
    stockNumber: formData.get('stockNumber'),
    cameraModel: formData.get('cameraModel'),
    appointmentDate: formData.get('appointmentDate'),
    comment: formData.get('comment'),
  }

  const result = schema.safeParse(rawData)
  if (!result.success) {
      return { error: 'Validation failed', fieldErrors: result.error.flatten().fieldErrors }
  }

  const data = result.data
  const fullVin = data.fullVin
  const vinValidated = validateVinFormat(fullVin)
  if ('error' in vinValidated) {
    return { error: vinValidated.error }
  }
  const vinLast6 = vinValidated.vin.slice(-6)
  const vehicleYear = modelYearHintFromVin(vinValidated.vin) ?? new Date().getFullYear()

  if (!profile.dealer_id) {
    return { error: 'Your account is not assigned to a dealer.' }
  }

  const validation = await validateAppointmentSlot(profile.dealer_id, data.appointmentDate)
  if (!validation.valid) {
    return { error: validation.error ?? 'This time slot is not available.' }
  }
  const appointmentDate = validation.canonicalIso ?? data.appointmentDate

  const timezoneName = await getDealerTimezone(profile.dealer_id)
  const slotTaken = !(await isSlotAvailableForDealer(supabase, profile.dealer_id, appointmentDate))
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
    vehicle_make: PENDING_VEHICLE_LABEL,
    vehicle_model: PENDING_VEHICLE_LABEL,
    vehicle_year: vehicleYear,
    stock_number: data.stockNumber ?? null,
    vin_last6: vinLast6,
    vin_decode_warning: true,
    camera_model: cameraCheck.cameraModelName,
    camera_model_id: cameraCheck.cameraModelId,
    appointment_date: appointmentDate,
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
      if (error.message?.includes('vin_decode_warning')) {
        return {
          error:
            'Database is missing the vin_decode_warning column. Run the latest Supabase migration locally (20261121120000_demands_vin_decode_warning.sql), then try again.',
        }
      }
      return { error: error.message || 'Failed to create demand. Please check your permissions.' }
  }

  revalidatePath('/dashboard/sales/demands')
  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard/admin/demands')
  revalidatePath('/dashboard/specialist/work')

  const { data: dealerRow } = await supabase
    .from('dealers')
    .select('name, warranty_years')
    .eq('id', profile.dealer_id)
    .single()

  const portal = await issuePortalTokenForDemand(data.phone, demand.id, profile.id)
  const portalUrl = portal?.url ?? null

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
      actorId: user.id,
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
      logNote: 'Demand created and approved; customer details pending portal',
      transitionFromStatus: null,
      sms: { customer: false, specialist: true, auroraManager: true },
    })
    if ('error' in finalized) {
      console.error('Auto-approve after create failed:', finalized.error)
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

    if (portalUrl) {
      await sendDealerHandoffLinkSms(data.phone, portalUrl, demand.id).catch((e) => {
        console.error('Background handoff SMS failed:', e)
      })
    }

    revalidatePath('/dashboard/sales/demands')
    revalidatePath('/dashboard/finance/demands')
    revalidatePath('/dashboard/admin/demands')
    revalidatePath('/dashboard/specialist/work')
  })

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
    portalUrl,
    smsSent: false,
    smsQueued: !!portalUrl,
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

