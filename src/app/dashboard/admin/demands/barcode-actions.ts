'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  changeDemandInstalledBarcode,
  type DemandBarcodeChangeReason,
} from '@/lib/inventory-barcodes/reassign-demand-barcode'
import { isBarcodeModeEnabled } from '@/lib/inventory-barcodes'

async function requireBarcodeChangeAccess() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can change installed barcodes' as const }
  }

  return { userId: user.id }
}

export async function changeDemandInstalledBarcodeAction(formData: FormData) {
  const auth = await requireBarcodeChangeAccess()
  if ('error' in auth && auth.error) return { error: auth.error }

  const demandId = String(formData.get('demand_id') ?? '').trim()
  const dealerId = String(formData.get('dealer_id') ?? '').trim()
  const specialistId = String(formData.get('specialist_id') ?? '').trim()
  const newBarcodeCode = String(formData.get('new_barcode_code') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim() as DemandBarcodeChangeReason
  const notes = String(formData.get('notes') ?? '').trim()
  const serviceType = String(formData.get('service_type') ?? 'installation') as
    | 'installation'
    | 'transfer'
    | 'removal'

  if (!demandId || !dealerId || !newBarcodeCode) {
    return { error: 'Demand, dealer, and new barcode are required' }
  }

  const supabase = await createClient()
  const enabled = await isBarcodeModeEnabled(supabase)
  if (!enabled) return { error: 'Barcode mode is not enabled' }

  const admin = createAdminClient()
  const result = await changeDemandInstalledBarcode(admin, {
    demandId,
    newBarcodeCode,
    reason,
    notes,
    actorId: auth.userId,
    specialistId,
    dealerId,
    serviceType,
  })

  if (result.error) return { error: result.error }

  revalidatePath(`/dashboard/admin/demands/${demandId}`)
  revalidatePath('/dashboard/admin/inventory')
  return { success: true, newCode: result.newCode }
}
