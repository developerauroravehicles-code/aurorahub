'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  assignSpecialistToDealers,
  removeSpecialistFromDealers,
} from '@/lib/specialist-dealer-assignments'

async function ensureCanManageSpecialistAssignments() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase: null as null, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['aurora_manager', 'it'].includes(profile.role)) {
    return {
      supabase: null as null,
      error: 'Only Aurora Managers or IT can manage specialist assignments',
    }
  }

  return { supabase, error: null as null }
}

export async function assignDealerToSpecialist(specialistId: string, dealerId: string) {
  const auth = await ensureCanManageSpecialistAssignments()
  if (!auth.supabase) return { success: false, error: auth.error ?? 'Unauthorized' }

  const { data: existing } = await auth.supabase
    .from('specialist_dealers')
    .select('id')
    .eq('specialist_id', specialistId)
    .eq('dealer_id', dealerId)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'This dealer is already assigned to this specialist' }
  }

  const result = await assignSpecialistToDealers(auth.supabase, specialistId, [dealerId])
  if (!result.success) return result

  revalidatePath(`/dashboard/admin/employees/${specialistId}`)
  revalidatePath('/dashboard/admin/employees')
  revalidatePath('/dashboard/configuration/calendar')

  return { success: true }
}

export async function removeDealerFromSpecialist(specialistId: string, dealerId: string) {
  const auth = await ensureCanManageSpecialistAssignments()
  if (!auth.supabase) return { success: false, error: auth.error ?? 'Unauthorized' }

  const result = await removeSpecialistFromDealers(auth.supabase, specialistId, [dealerId])
  if (!result.success) return result

  revalidatePath(`/dashboard/admin/employees/${specialistId}`)
  revalidatePath('/dashboard/admin/employees')
  revalidatePath('/dashboard/configuration/calendar')

  return { success: true }
}
