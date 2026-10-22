'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logDemandChange } from '@/lib/demand-logger'
import { dispatchWebhooks } from '@/lib/webhook-dispatch'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { wallDateToAppointmentIso } from '@/lib/external-demand-date'
import type { ExternalDemandFormDraft } from '@/lib/external-demand-form-draft'
import {
  DemandServiceType,
  isBarcodeRequiredForServiceType,
  isDemandServiceType,
} from '@/lib/demand-pricing'
import { addDemandToDailyBatch } from '@/lib/daily-dealer-invoices'
import { notifyAuroraManagersIfDuplicateStock } from '@/lib/notify-duplicate-stock'
import {
  consumeBarcodesForDemand,
  isBarcodeModeEnabled,
  lookupUnitBarcodeAtSpecialist,
  rollbackDemandBarcodeConsumption,
  validateUnitBarcodesAtSpecialist,
} from '@/lib/inventory-barcodes'
import { inferBookingCameraFromScannedUnits } from '@/lib/camera-model-infer-from-units'
import {
  getActiveCameraModelById,
  lookupCameraModelId,
} from '@/lib/camera-model-resolve'
import { validateDealerBookingCamera } from '@/lib/dealer-camera-catalog'
import { resolveExternalDemandCameraAndPrice } from './create-external-demand-pricing'
import { upsertInventoryPricingRule } from '@/app/dashboard/admin/inventory/actions'
import { applyExternalDemandCompletion } from '@/lib/external-demand-completion'

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

export type CreateExternalDemandState = {
  error?: string
  success?: boolean
  fieldErrors?: Record<string, string[]>
  draft?: ExternalDemandFormDraft
} | null

function parseDraftPayload(formData: FormData): ExternalDemandFormDraft | undefined {
  const raw = formData.get('draftPayload')
  if (!raw || typeof raw !== 'string') return undefined
  try {
    const parsed = JSON.parse(raw) as ExternalDemandFormDraft
    if (parsed?.version === 1) return parsed
  } catch {
    /* ignore */
  }
  return undefined
}

function withDraft(
  formData: FormData,
  body: Omit<NonNullable<CreateExternalDemandState>, 'draft'>
): CreateExternalDemandState {
  const draft = parseDraftPayload(formData)
  return draft ? { ...body, draft } : body
}

async function requireAuroraManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }

  const { data: profile } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Managers can create external demands' as const }
  }
  return { supabase, user, profile }
}

function readParsedForm(formData: FormData) {
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
  return schema.safeParse(rawData)
}

export async function previewExternalDemandBarcode(specialistId: string, code: string) {
  const auth = await requireAuroraManager()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized' }

  const trimmed = code.trim()
  if (!trimmed) return { error: 'Enter a barcode' as const }
  if (!specialistId.trim()) return { error: 'Select a specialist before scanning barcodes' as const }

  const admin = createAdminClient()
  const resolved = await lookupUnitBarcodeAtSpecialist(admin, trimmed, specialistId.trim(), {
    allowOrphanedConsumed: true,
  })
  if ('error' in resolved) return { error: resolved.error as string }

  return {
    ok: true as const,
    code: trimmed.toUpperCase(),
    modelName: resolved.cameraModelName ?? 'Unit',
    cameraModelId: resolved.cameraModelId,
  }
}

/** Suggest booking catalog camera from scanned unit model ids (set template or single unit). */
export async function suggestExternalDemandCameraModel(
  dealerId: string,
  unitCameraModelIds: string[]
) {
  const auth = await requireAuroraManager()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized' }

  if (!dealerId.trim()) return { error: 'Select a dealer first' as const }

  const inferred = await inferBookingCameraFromScannedUnits(auth.supabase, unitCameraModelIds)
  if (!inferred) return { error: 'Could not match scanned units to a catalog camera' as const }

  const assigned = await validateDealerBookingCamera(auth.supabase, dealerId, {
    cameraModelId: inferred.cameraModelId,
  })
  if ('error' in assigned) {
    return { error: assigned.error as string }
  }

  return {
    ok: true as const,
    cameraModelId: assigned.cameraModelId,
    cameraModelName: assigned.cameraModelName,
  }
}

/** Validate completion pricing before submit (no DB writes). */
export async function previewExternalDemandCompletionPricing(formData: FormData) {
  const auth = await requireAuroraManager()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized' }

  const result = readParsedForm(formData)
  if (!result.success) {
    return { error: 'Validation failed' as const }
  }

  const completeOnCreate = formData.get('completeOnCreate') === 'true'
  const serviceTypeRaw = completeOnCreate ? String(formData.get('serviceType') ?? '').trim() : ''
  if (!completeOnCreate || !isDemandServiceType(serviceTypeRaw)) {
    return { ok: true as const, skipped: true as const }
  }

  const barcodeCodes = formData
    .getAll('barcodeCodes')
    .map((v) => String(v).trim())
    .filter(Boolean)

  const resolved = await resolveExternalDemandCameraAndPrice(auth.supabase, {
    dealerId: result.data.dealerId,
    cameraModel: result.data.cameraModel,
    cameraModelIdFromForm: String(formData.get('cameraModelId') ?? '').trim(),
    completeOnCreate: true,
    serviceType: serviceTypeRaw,
    barcodeCodes,
    assignedSpecialistId: result.data.assignedSpecialistId,
  })

  if ('error' in resolved) {
    return {
      error: resolved.error,
      missingPrice: resolved.missingPrice,
    }
  }

  return { ok: true as const, amount: resolved.amount }
}

/** Dry-run barcode checks (same rules as consume, no writes). */
export async function validateExternalDemandBarcodes(
  specialistId: string,
  codes: string[]
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireAuroraManager()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized' }

  const admin = createAdminClient()
  return validateUnitBarcodesAtSpecialist(admin, codes, specialistId.trim(), {
    allowOrphanedConsumed: true,
  })
}

export async function saveDealerInstallationPriceForExternalDemand(input: {
  dealerId: string
  cameraModelId: string
  priceCad: number
}): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAuroraManager()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized' }

  if (!input.dealerId.trim() || !input.cameraModelId.trim()) {
    return { error: 'Dealer and camera model are required' }
  }
  if (!Number.isFinite(input.priceCad) || input.priceCad < 0) {
    return { error: 'Price must be 0 or greater' }
  }

  const fd = new FormData()
  fd.set('scope_type', 'dealer')
  fd.set('scope_id', input.dealerId.trim())
  fd.set('camera_model_id', input.cameraModelId.trim())
  fd.set('service_type', 'installation')
  fd.set('price_cad', String(input.priceCad))

  return upsertInventoryPricingRule(fd)
}

export async function createExternalDemand(
  prevState: CreateExternalDemandState,
  formData: FormData
): Promise<CreateExternalDemandState> {
  const auth = await requireAuroraManager()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized' }

  const { supabase, user, profile } = auth

  const result = readParsedForm(formData)
  if (!result.success) {
    return withDraft(formData, {
      error: 'Validation failed',
      fieldErrors: result.error.flatten().fieldErrors,
    })
  }

  const data = result.data

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
    return withDraft(formData, { error: 'Invalid appointment date' })
  }

  const completeOnCreate = formData.get('completeOnCreate') === 'true'
  const serviceTypeRaw = completeOnCreate ? String(formData.get('serviceType') ?? '').trim() : ''
  if (completeOnCreate && !isDemandServiceType(serviceTypeRaw)) {
    return withDraft(formData, {
      error: 'Service type is required when marking as completed on creation.',
    })
  }
  const serviceType = completeOnCreate ? (serviceTypeRaw as DemandServiceType) : null

  const barcodeMode = await isBarcodeModeEnabled(supabase)
  const barcodeCodes = formData
    .getAll('barcodeCodes')
    .map((v) => String(v).trim())
    .filter(Boolean)

  if (completeOnCreate && barcodeMode && serviceType) {
    const barcodeRequired = isBarcodeRequiredForServiceType(serviceType)
    if (barcodeRequired) {
      if (!data.assignedSpecialistId) {
        return withDraft(formData, {
          error:
            'Select the specialist who performed the install — barcodes are consumed from their field stock.',
        })
      }
      if (barcodeCodes.length === 0) {
        return withDraft(formData, {
          error: 'Scan at least one product barcode (unit label) before completing.',
        })
      }
    } else if (barcodeCodes.length > 0 && !data.assignedSpecialistId) {
      return withDraft(formData, {
        error: 'Select the specialist whose field stock the scanned barcodes belong to.',
      })
    }
  }

  if (
    completeOnCreate &&
    barcodeMode &&
    serviceType &&
    data.assignedSpecialistId &&
    barcodeCodes.length > 0
  ) {
    const admin = createAdminClient()
    const barcodeCheck = await validateUnitBarcodesAtSpecialist(
      admin,
      barcodeCodes,
      data.assignedSpecialistId,
      { allowOrphanedConsumed: true }
    )
    if ('error' in barcodeCheck) {
      return withDraft(formData, { error: barcodeCheck.error })
    }
  }

  const cameraModelIdFromForm = String(formData.get('cameraModelId') ?? '').trim()

  let resolvedCameraModelId =
    (await getActiveCameraModelById(supabase, cameraModelIdFromForm))?.id ??
    (await lookupCameraModelId(supabase, data.cameraModel))
  let resolvedCameraModelName = data.cameraModel
  let invoiceTotalAmount: number | undefined

  if (completeOnCreate && serviceType) {
    const pricing = await resolveExternalDemandCameraAndPrice(supabase, {
      dealerId: data.dealerId,
      cameraModel: data.cameraModel,
      cameraModelIdFromForm,
      completeOnCreate: true,
      serviceType,
      barcodeCodes,
      assignedSpecialistId: data.assignedSpecialistId,
    })
    if ('error' in pricing) {
      return withDraft(formData, { error: pricing.error })
    }
    invoiceTotalAmount = pricing.amount
    resolvedCameraModelId = pricing.cameraModelId
    resolvedCameraModelName = pricing.cameraModelName
  }

  const cameraCheck = await validateDealerBookingCamera(supabase, data.dealerId, {
    cameraModelId: resolvedCameraModelId,
    cameraModelName: resolvedCameraModelName,
  })
  if ('error' in cameraCheck) {
    return withDraft(formData, { error: cameraCheck.error })
  }
  resolvedCameraModelId = cameraCheck.cameraModelId
  resolvedCameraModelName = cameraCheck.cameraModelName

  const cameraModelId = resolvedCameraModelId

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
    camera_model: resolvedCameraModelName,
    ...(cameraModelId && { camera_model_id: cameraModelId }),
    appointment_date: appointmentDateISO,
    status: completeOnCreate ? 'completed' : 'pending_finance',
    ...(completeOnCreate && { completed_at: appointmentDateISO }),
    ...(completeOnCreate && serviceType && { service_type: serviceType }),
    ...(completeOnCreate && invoiceTotalAmount != null && { invoice_total_amount: invoiceTotalAmount }),
    is_external: true,
    ...(data.comment?.trim() && { comment: data.comment.trim() }),
    ...(data.assignedSpecialistId && { assigned_specialist_id: data.assignedSpecialistId }),
  }

  // Pricing and catalog checks run above — barcodes are consumed only after a successful demand insert.
  const { data: demand, error } = await supabase.from('demands').insert(insertData).select().single()

  if (error) {
    console.error('External demand creation error:', error)
    return withDraft(formData, { error: error.message || 'Failed to create demand.' })
  }

  if (completeOnCreate) {
    const admin = createAdminClient()

    if (barcodeMode && serviceType && data.assignedSpecialistId && barcodeCodes.length > 0) {
      const consumeResult = await consumeBarcodesForDemand(supabase, admin, {
        codes: barcodeCodes,
        demandId: demand.id,
        specialistId: data.assignedSpecialistId,
        dealerId: data.dealerId,
        actorId: user.id,
        serviceType,
        adminResolveForSpecialist: true,
      })
      if (consumeResult.error) {
        await rollbackDemandBarcodeConsumption(admin, {
          demandId: demand.id,
          actorId: user.id,
          reason: 'External demand create aborted after barcode consume failure',
        })
        await admin.from('demands').delete().eq('id', demand.id)
        return withDraft(formData, { error: consumeResult.error })
      }
    }

    addDemandToDailyBatch(admin, demand.id).catch(() => {})
  }

  logDemandChange({
    demandId: demand.id,
    actorId: user.id,
    previousStatus: null,
    newStatus: demand.status,
    notes: completeOnCreate
      ? 'External demand created and marked completed by Aurora Manager'
      : 'External demand created by Aurora Manager',
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

export type CompleteExternalDemandState = { error?: string; success?: boolean } | null

/** Mark an existing external demand completed (retroactive close) — Aurora Manager only. */
export async function completeExternalDemand(
  _prev: CompleteExternalDemandState,
  formData: FormData
): Promise<CompleteExternalDemandState> {
  const auth = await requireAuroraManager()
  if ('error' in auth) return { error: auth.error }

  const { supabase, user } = auth
  const demandId = String(formData.get('demandId') ?? '').trim()
  const serviceTypeRaw = String(formData.get('serviceType') ?? '').trim()
  const assignedSpecialistId = String(formData.get('assignedSpecialistId') ?? '').trim() || undefined
  const cameraModelIdFromForm = String(formData.get('cameraModelId') ?? '').trim()
  const barcodeCodes = formData
    .getAll('barcodeCodes')
    .map((v) => String(v).trim())
    .filter(Boolean)

  if (!demandId) return { error: 'Demand is required.' }
  if (!isDemandServiceType(serviceTypeRaw)) {
    return { error: 'Select a valid service type.' }
  }
  const serviceType = serviceTypeRaw as DemandServiceType

  const { data: demand, error: fetchErr } = await supabase
    .from('demands')
    .select(
      'id, dealer_id, appointment_date, camera_model, camera_model_id, assigned_specialist_id, status, is_external'
    )
    .eq('id', demandId)
    .single()

  if (fetchErr || !demand) return { error: 'Demand not found.' }
  if (!demand.is_external) {
    return { error: 'Only external demands can be completed from this action.' }
  }
  if (demand.status !== 'pending_finance' && demand.status !== 'approved') {
    return { error: 'Only pending or approved external demands can be marked completed here.' }
  }
  if (!demand.dealer_id) return { error: 'Demand has no dealer.' }

  const admin = createAdminClient()
  const completion = await applyExternalDemandCompletion({
    supabase,
    admin,
    user,
    demand: {
      id: demand.id,
      dealer_id: demand.dealer_id,
      appointment_date: demand.appointment_date,
      camera_model: demand.camera_model,
      camera_model_id: demand.camera_model_id,
      assigned_specialist_id: demand.assigned_specialist_id,
      status: demand.status,
    },
    serviceType,
    barcodeCodes,
    assignedSpecialistId,
    cameraModelIdFromForm,
    previousStatus: demand.status,
  })

  if (completion.error) return { error: completion.error }

  revalidatePath('/dashboard/admin/demands')
  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  revalidatePath('/dashboard/admin/invoices')
  revalidatePath('/dashboard/admin/daily-invoices')
  return { success: true }
}
