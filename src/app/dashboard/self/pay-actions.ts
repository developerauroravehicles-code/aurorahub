'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchSpecialistCompensationSnapshot } from '@/lib/specialist-compensation-snapshot'
import type { SpecialistCompensationSnapshot } from '@/lib/specialist-compensation'

export async function getSelfSpecialistPaySnapshot(
  periodStart?: string,
  periodEnd?: string
): Promise<{ error?: string; snapshot?: SpecialistCompensationSnapshot }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, dealer_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.dealer_id != null) {
    return { error: 'Pay estimate is only available for platform specialists.' }
  }

  if (profile.role !== 'specialist') {
    return { error: 'Pay estimate is only available for Technical Support.' }
  }

  try {
    const snapshot = await fetchSpecialistCompensationSnapshot(
      supabase,
      user.id,
      periodStart,
      periodEnd
    )
    return { snapshot }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load pay estimate' }
  }
}
