'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendNewCriticalTicketAlertIfEnabled, sendCriticalIncidentAlertIfEnabled } from '@/lib/alert-dispatch'

async function ensureAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', supabase: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['aurora_manager', 'it'].includes(profile?.role ?? '')) {
    return { error: 'Unauthorized', supabase: null }
  }
  return { supabase, userId: user.id }
}

// Tickets
export async function createTicket(formData: {
  title: string
  description?: string
  category: string
  priority?: string
  assigned_to?: string
}) {
  const { supabase, userId } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const priority = formData.priority || 'medium'
  const { data: ticket, error } = await supabase
    .from('it_tickets')
    .insert({
      title: formData.title.trim(),
      description: formData.description?.trim() || null,
      category: formData.category,
      priority,
      assigned_to: formData.assigned_to || null,
      requested_by: userId,
    })
    .select('id, ticket_number, title')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  if (priority === 'critical' && ticket) {
    sendNewCriticalTicketAlertIfEnabled(ticket).catch(console.error)
  }
  return { success: true }
}

export async function updateTicket(id: string, formData: {
  title?: string
  description?: string
  category?: string
  priority?: string
  status?: string
  assigned_to?: string
  sla_due_at?: string
  resolution_notes?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.title != null) update.title = formData.title.trim()
  if (formData.description != null) update.description = formData.description?.trim() || null
  if (formData.category != null) update.category = formData.category
  if (formData.priority != null) update.priority = formData.priority
  if (formData.status != null) {
    update.status = formData.status
    if (['resolved', 'closed'].includes(formData.status)) update.resolved_at = new Date().toISOString()
  }
  if (formData.assigned_to != null) update.assigned_to = formData.assigned_to || null
  if (formData.sla_due_at != null) update.sla_due_at = formData.sla_due_at || null
  if (formData.resolution_notes != null) update.resolution_notes = formData.resolution_notes?.trim() || null
  update.updated_at = new Date().toISOString()
  const { error } = await supabase.from('it_tickets').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}

export async function deleteTicket(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('it_tickets').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}

// Incidents
export async function createIncident(formData: {
  title: string
  description?: string
  severity: string
  impact_scope?: string
}) {
  const { supabase, userId } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const severity = formData.severity || 'medium'
  const { data: incident, error } = await supabase
    .from('it_incidents')
    .insert({
      title: formData.title.trim(),
      description: formData.description?.trim() || null,
      severity,
      impact_scope: formData.impact_scope?.trim() || null,
      created_by: userId,
    })
    .select('id, incident_number, title, status')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  if (severity === 'critical' && incident) {
    sendCriticalIncidentAlertIfEnabled(incident).catch(console.error)
  }
  return { success: true }
}

export async function updateIncident(id: string, formData: {
  title?: string
  description?: string
  severity?: string
  impact_scope?: string
  status?: string
  root_cause?: string
  resolution_notes?: string
  post_mortem?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.title != null) update.title = formData.title.trim()
  if (formData.description != null) update.description = formData.description?.trim() || null
  if (formData.severity != null) update.severity = formData.severity
  if (formData.impact_scope != null) update.impact_scope = formData.impact_scope?.trim() || null
  if (formData.status != null) {
    update.status = formData.status
    if (['resolved', 'closed'].includes(formData.status)) update.resolved_at = new Date().toISOString()
  }
  if (formData.root_cause != null) update.root_cause = formData.root_cause?.trim() || null
  if (formData.resolution_notes != null) update.resolution_notes = formData.resolution_notes?.trim() || null
  if (formData.post_mortem != null) update.post_mortem = formData.post_mortem?.trim() || null
  update.updated_at = new Date().toISOString()
  const { error } = await supabase.from('it_incidents').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}

export async function deleteIncident(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('it_incidents').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}

// Changes
export async function createChange(formData: {
  title: string
  description?: string
  change_type: string
  risk_level?: string
  scheduled_at?: string
  rollback_plan?: string
}) {
  const { supabase, userId } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('it_changes').insert({
    title: formData.title.trim(),
    description: formData.description?.trim() || null,
    change_type: formData.change_type,
    risk_level: formData.risk_level || 'medium',
    scheduled_at: formData.scheduled_at || null,
    rollback_plan: formData.rollback_plan?.trim() || null,
    created_by: userId,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}

export async function updateChange(id: string, formData: {
  title?: string
  description?: string
  change_type?: string
  risk_level?: string
  status?: string
  scheduled_at?: string
  rollback_plan?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.title != null) update.title = formData.title.trim()
  if (formData.description != null) update.description = formData.description?.trim() || null
  if (formData.change_type != null) update.change_type = formData.change_type
  if (formData.risk_level != null) update.risk_level = formData.risk_level
  if (formData.status != null) {
    update.status = formData.status
    if (formData.status === 'deployed') update.deployed_at = new Date().toISOString()
  }
  if (formData.scheduled_at != null) update.scheduled_at = formData.scheduled_at || null
  if (formData.rollback_plan != null) update.rollback_plan = formData.rollback_plan?.trim() || null
  update.updated_at = new Date().toISOString()
  const { error } = await supabase.from('it_changes').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}

export async function deleteChange(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('it_changes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}

// Releases
export async function createRelease(formData: {
  version: string
  build_number?: string
  release_notes?: string
  environment: string
}) {
  const { supabase, userId } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('it_releases').insert({
    version: formData.version.trim(),
    build_number: formData.build_number?.trim() || null,
    release_notes: formData.release_notes?.trim() || null,
    environment: formData.environment,
    created_by: userId,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}

export async function updateRelease(id: string, formData: {
  version?: string
  build_number?: string
  release_notes?: string
  status?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.version != null) update.version = formData.version.trim()
  if (formData.build_number != null) update.build_number = formData.build_number?.trim() || null
  if (formData.release_notes != null) update.release_notes = formData.release_notes?.trim() || null
  if (formData.status != null) {
    update.status = formData.status
    if (formData.status === 'deployed') update.deployed_at = new Date().toISOString()
  }
  const { error } = await supabase.from('it_releases').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}

export async function deleteRelease(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('it_releases').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}

// Knowledge Base
export async function createKnowledgeArticle(formData: {
  title: string
  content?: string
  category?: string
}) {
  const { supabase, userId } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('it_knowledge_base').insert({
    title: formData.title.trim(),
    content: formData.content?.trim() || null,
    category: formData.category || null,
    created_by: userId,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}

export async function updateKnowledgeArticle(id: string, formData: {
  title?: string
  content?: string
  category?: string
}) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const update: Record<string, unknown> = {}
  if (formData.title != null) update.title = formData.title.trim()
  if (formData.content != null) update.content = formData.content?.trim() || null
  if (formData.category != null) update.category = formData.category || null
  update.updated_at = new Date().toISOString()
  const { error } = await supabase.from('it_knowledge_base').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}

export async function deleteKnowledgeArticle(id: string) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }
  const { error } = await supabase.from('it_knowledge_base').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/operations/service-desk')
  return { success: true }
}
