'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function ensureAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', supabase: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'hr' && profile?.role !== 'aurora_manager') {
    return { error: 'Unauthorized', supabase: null }
  }
  return { supabase }
}

export async function createTrainingProgram(formData: { name: string; description?: string; category?: string }) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('training_programs').insert({
    name: formData.name.trim(),
    description: formData.description?.trim() || null,
    category: formData.category?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/training')
  return { success: true }
}

export async function updateTrainingProgram(id: string, formData: { name: string; description?: string; category?: string }) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('training_programs').update({
    name: formData.name.trim(),
    description: formData.description?.trim() || null,
    category: formData.category?.trim() || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/training')
  return { success: true }
}

export async function deleteTrainingProgram(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('training_programs').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/training')
  return { success: true }
}

export async function recordCompletion(personnelId: string, programId: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('personnel_training_completions').upsert(
    { personnel_id: personnelId, program_id: programId, completed_at: new Date().toISOString() },
    { onConflict: 'personnel_id,program_id' }
  )
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/training')
  return { success: true }
}

export async function deleteCompletion(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('personnel_training_completions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/training')
  return { success: true }
}

export async function createCertification(formData: {
  personnel_id: string
  certification_type: string
  name?: string
  institution?: string
  issue_date: string
  expiry_date?: string
  status?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const validTypes = ['dashcam_installation', 'vehicle_electronics', 'safety_training', 'insurance_compliance', 'customer_service', 'other']
  const certType = validTypes.includes(formData.certification_type) ? formData.certification_type : 'other'
  const { error } = await supabase.from('personnel_certifications').insert({
    personnel_id: formData.personnel_id,
    certification_type: certType,
    name: formData.name?.trim() || null,
    institution: formData.institution?.trim() || null,
    issue_date: formData.issue_date,
    expiry_date: formData.expiry_date || null,
    status: formData.status || 'awaiting',
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/training')
  revalidatePath(`/dashboard/hr/personnel/${formData.personnel_id}`)
  return { success: true }
}

export async function updateCertification(id: string, formData: { status?: string; expiry_date?: string }) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.status != null) update.status = formData.status
  if (formData.expiry_date != null) update.expiry_date = formData.expiry_date || null
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('personnel_certifications').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/training')
  return { success: true }
}

export async function deleteCertification(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('personnel_certifications').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/training')
  return { success: true }
}
