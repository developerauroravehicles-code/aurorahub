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

// Compliance documents
export async function createComplianceDocument(formData: {
  personnel_id: string
  document_type?: string
  title?: string
  province?: string
  document_url?: string
  expiry_date?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('compliance_documents').insert({
    personnel_id: formData.personnel_id,
    document_type: formData.document_type?.trim() || null,
    title: formData.title?.trim() || null,
    province: formData.province || null,
    document_url: formData.document_url?.trim() || null,
    expiry_date: formData.expiry_date || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/compliance')
  revalidatePath(`/dashboard/hr/personnel/${formData.personnel_id}`)
  return { success: true }
}

export async function updateComplianceDocument(
  id: string,
  formData: { document_type?: string; title?: string; province?: string; document_url?: string; expiry_date?: string; verified_at?: string }
) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.document_type != null) update.document_type = formData.document_type?.trim() || null
  if (formData.title != null) update.title = formData.title?.trim() || null
  if (formData.province != null) update.province = formData.province || null
  if (formData.document_url != null) update.document_url = formData.document_url?.trim() || null
  if (formData.expiry_date != null) update.expiry_date = formData.expiry_date || null
  if (formData.verified_at != null) update.verified_at = formData.verified_at || null
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('compliance_documents').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/compliance')
  return { success: true }
}

export async function deleteComplianceDocument(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('compliance_documents').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/compliance')
  return { success: true }
}

export async function markDocumentVerified(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase
    .from('compliance_documents')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/compliance')
  return { success: true }
}

// Compliance checklists
export async function createComplianceChecklist(formData: {
  personnel_id: string
  item_name: string
  notes?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('compliance_checklists').insert({
    personnel_id: formData.personnel_id,
    item_name: formData.item_name.trim(),
    notes: formData.notes?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/compliance')
  revalidatePath(`/dashboard/hr/personnel/${formData.personnel_id}`)
  return { success: true }
}

export async function updateComplianceChecklist(
  id: string,
  formData: { item_name?: string; completed?: boolean; notes?: string }
) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.item_name != null) update.item_name = formData.item_name.trim()
  if (formData.completed != null) {
    update.completed = formData.completed
    if (formData.completed) update.completed_at = new Date().toISOString()
    else update.completed_at = null
  }
  if (formData.notes != null) update.notes = formData.notes?.trim() || null
  if (Object.keys(update).length === 0) return { success: true }
  const { error } = await supabase.from('compliance_checklists').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/compliance')
  return { success: true }
}

export async function deleteComplianceChecklist(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('compliance_checklists').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/compliance')
  return { success: true }
}
