'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  assignBarcodeToDealer,
  assignBarcodeToSpecialist,
  voidBarcode,
  generateSetBarcodes,
  generateUnitBarcodes,
  getBarcodeSettings,
  saveBarcodeSettings,
  fetchBarcodeRegistry,
  fetchBarcodeEvents,
  fetchSetTemplates,
  type BarcodeSettings,
} from '@/lib/inventory-barcodes'

async function requireAuroraManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, supabase, userId: null as string | null }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can manage barcodes' as const, supabase, userId: null as string | null }
  }
  return { supabase, userId: user.id }
}

export async function loadBarcodePanelData(search?: string) {
  const auth = await requireAuroraManager()
  if (auth.error) return { error: auth.error }

  const [settings, templates, registry] = await Promise.all([
    getBarcodeSettings(auth.supabase),
    fetchSetTemplates(auth.supabase),
    fetchBarcodeRegistry(auth.supabase, { search, limit: 300 }),
  ])

  return { settings, templates, registry }
}

export async function saveBarcodeSettingsAction(settings: BarcodeSettings) {
  const auth = await requireAuroraManager()
  if (auth.error) return { error: auth.error }

  const result = await saveBarcodeSettings(auth.supabase, settings)
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
}

export async function createBarcodeSetTemplate(formData: FormData) {
  const auth = await requireAuroraManager()
  if (auth.error) return { error: auth.error }

  const name = String(formData.get('name') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const description = String(formData.get('description') ?? '').trim() || null

  if (!name || !code) return { error: 'Name and code are required' }

  const { data: template, error } = await auth.supabase
    .from('inventory_barcode_set_templates')
    .insert({ name, code, description })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const itemsRaw = String(formData.get('items_json') ?? '[]')
  let items: { camera_model_id: string; quantity: number }[] = []
  try {
    items = JSON.parse(itemsRaw)
  } catch {
    return { error: 'Invalid items payload' }
  }

  if (!items.length) return { error: 'Add at least one product to the set template' }

  const rows = items
    .filter((i) => i.camera_model_id && i.quantity >= 1)
    .map((i) => ({
      template_id: template.id,
      camera_model_id: i.camera_model_id,
      quantity: i.quantity,
    }))

  const { error: itemsError } = await auth.supabase
    .from('inventory_barcode_set_template_items')
    .insert(rows)

  if (itemsError) return { error: itemsError.message }

  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
}

export async function deleteBarcodeSetTemplate(templateId: string) {
  const auth = await requireAuroraManager()
  if (auth.error) return { error: auth.error }

  const { error } = await auth.supabase
    .from('inventory_barcode_set_templates')
    .delete()
    .eq('id', templateId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
}

export async function generateUnitBarcodesAction(formData: FormData) {
  const auth = await requireAuroraManager()
  if (auth.error) return { error: auth.error }

  const cameraModelId = String(formData.get('camera_model_id') ?? '').trim()
  const count = parseInt(String(formData.get('count') ?? '1'), 10)

  if (!cameraModelId) return { error: 'Camera model is required' }

  const result = await generateUnitBarcodes(auth.supabase, {
    cameraModelId,
    count,
    createdBy: auth.userId,
  })

  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/admin/inventory')
  return { success: true, barcodes: result.barcodes ?? [] }
}

export async function generateSetBarcodesAction(formData: FormData) {
  const auth = await requireAuroraManager()
  if (auth.error) return { error: auth.error }

  const templateId = String(formData.get('template_id') ?? '').trim()
  const setCount = parseInt(String(formData.get('set_count') ?? '1'), 10)

  if (!templateId) return { error: 'Set template is required' }

  const result = await generateSetBarcodes(auth.supabase, {
    templateId,
    setCount,
    createdBy: auth.userId,
  })

  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/admin/inventory')
  return { success: true, barcodes: result.barcodes ?? [] }
}

export async function scanAssignBarcodeToDealer(formData: FormData) {
  const auth = await requireAuroraManager()
  if (auth.error) return { error: auth.error }

  const code = String(formData.get('code') ?? '').trim()
  const dealerId = String(formData.get('dealer_id') ?? '').trim()

  if (!code || !dealerId) return { error: 'Barcode and dealer are required' }

  const result = await assignBarcodeToDealer(auth.supabase, {
    code,
    dealerId,
    actorId: auth.userId,
  })

  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/admin/inventory')
  return { success: true, barcode: result.barcode }
}

export async function scanAssignBarcodeToSpecialist(formData: FormData) {
  const auth = await requireAuroraManager()
  if (auth.error) return { error: auth.error }

  const code = String(formData.get('code') ?? '').trim()
  const dealerId = String(formData.get('dealer_id') ?? '').trim()
  const specialistId = String(formData.get('specialist_id') ?? '').trim()

  if (!code || !dealerId || !specialistId) {
    return { error: 'Barcode, dealer, and specialist are required' }
  }

  const result = await assignBarcodeToSpecialist(auth.supabase, {
    code,
    dealerId,
    specialistId,
    actorId: auth.userId,
  })

  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/admin/inventory')
  return { success: true, barcode: result.barcode }
}

export async function voidBarcodeAction(barcodeId: string) {
  const auth = await requireAuroraManager()
  if (auth.error) return { error: auth.error }

  const result = await voidBarcode(auth.supabase, barcodeId, auth.userId)
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
}

export async function getBarcodeTraceEvents(barcodeId: string) {
  const auth = await requireAuroraManager()
  if (auth.error) return { error: auth.error, events: [] }

  const events = await fetchBarcodeEvents(auth.supabase, barcodeId)
  return { events }
}
