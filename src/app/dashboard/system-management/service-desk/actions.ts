'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendNewCriticalTicketAlertIfEnabled, sendCriticalIncidentAlertIfEnabled, sendTicketStatusChangeEmail, sendNewTicketEmailToIT } from '@/lib/alert-dispatch'
import { uploadTicketScreenshotsToDrive, type GoogleDriveSettings } from '@/lib/google-drive'

/** Stored on it_tickets.screenshots (Google Drive references) */
export type TicketScreenshot = {
  fileId: string
  webViewLink?: string | null
  name: string
}

const TICKET_SCREENSHOT_MAX_FILES = 3
const TICKET_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024
const TICKET_SCREENSHOT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

async function ensureAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', supabase: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['aurora_manager', 'it'].includes(profile?.role ?? '')) {
    return { error: 'Unauthorized', supabase: null }
  }
  // Use admin client for IT and aurora_manager to bypass RLS - ensures they can view content and change ticket status
  const db = createAdminClient()
  return { supabase: db, userId: user.id }
}

function parseTicketScreenshots(value: unknown): TicketScreenshot[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const fileId = typeof row.fileId === 'string' ? row.fileId : null
    if (!fileId) return []
    const name = typeof row.name === 'string' ? row.name : fileId
    const webViewLink = typeof row.webViewLink === 'string' ? row.webViewLink : null
    return [{ fileId, name, webViewLink }]
  })
}

async function getValidatedDriveSettings(supabase: ReturnType<typeof createAdminClient>): Promise<GoogleDriveSettings | null> {
  const { data: settingsRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'google_drive_settings')
    .single()

  let settings: GoogleDriveSettings | null = null
  try {
    if (settingsRow?.value && typeof settingsRow.value === 'string') {
      settings = JSON.parse(settingsRow.value) as GoogleDriveSettings
    }
  } catch {
    settings = null
  }

  const driveConfigured =
    !!settings?.enabled
    && typeof settings?.defaultFolderId === 'string'
    && settings.defaultFolderId.trim() !== ''

  const hasOAuth = !!(
    settings?.useOAuth
    && settings.refreshToken?.trim()
    && settings.clientId?.trim()
    && settings.clientSecret?.trim()
  )
  const hasSa = !!(
    (settings?.serviceAccountEmail || settings?.clientEmail)?.trim()
    && (settings?.serviceAccountPrivateKey || settings?.privateKey)?.trim()
  )

  if (!driveConfigured || (!hasOAuth && !hasSa)) return null
  return settings
}

// Tickets — use FormData from the Service Desk ticket form so image files can be uploaded (screenshots ≤ 3)
export async function createTicket(formData: FormData) {
  const { supabase, userId } = await ensureAuth()
  if (!supabase || !userId) return { error: 'Not authenticated' }

  const title = String(formData.get('title') ?? '').trim()
  const descriptionRaw = formData.get('description')
  const description = typeof descriptionRaw === 'string' ? descriptionRaw.trim() : ''
  const category = String(formData.get('category') ?? '')
  const priority = String(formData.get('priority') ?? 'medium') || 'medium'
  const assignedToRaw = String(formData.get('assigned_to') ?? '').trim()
  let assignedTo: string | null = assignedToRaw || null

  if (!title) return { error: 'Title is required' }
  if (!category) return { error: 'Category is required' }

  const rawScreenshots = formData.getAll('screenshots').filter((s): s is File => s instanceof File && s.size > 0)

  if (rawScreenshots.length > TICKET_SCREENSHOT_MAX_FILES) {
    return { error: `You can attach at most ${TICKET_SCREENSHOT_MAX_FILES} screenshots.` }
  }

  const imagePayload: Array<{ buffer: Buffer; mimeType: string; fileName: string }> = []

  for (const file of rawScreenshots) {
    const mimeType = file.type || 'application/octet-stream'
    if (!TICKET_SCREENSHOT_MIME_TYPES.has(mimeType)) {
      return { error: 'Screenshots must be JPG, PNG, WebP, or GIF.' }
    }
    if (file.size > TICKET_SCREENSHOT_MAX_BYTES) {
      return { error: `Each screenshot must be ${TICKET_SCREENSHOT_MAX_BYTES / (1024 * 1024)} MB or smaller.` }
    }
    const arrayBuffer = await file.arrayBuffer()
    imagePayload.push({
      buffer: Buffer.from(arrayBuffer),
      mimeType,
      fileName: file.name || 'screenshot.png',
    })
  }

  let driveSettingsForUpload: GoogleDriveSettings | null = null
  if (imagePayload.length > 0) {
    driveSettingsForUpload = await getValidatedDriveSettings(supabase)
    if (!driveSettingsForUpload) {
      return {
        error: 'Google Drive is required for screenshots. Enable it under Integrations (External APIs / API) with a folder ID.',
      }
    }
  }

  if (!assignedTo) {
    const { data: itUsers } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'it')
    if (itUsers?.length === 1) {
      assignedTo = itUsers[0].id
    }
  }

  const { data: ticket, error } = await supabase
    .from('it_tickets')
    .insert({
      title,
      description: description || null,
      category,
      priority,
      assigned_to: assignedTo,
      requested_by: userId,
      screenshots: [],
    })
    .select('id, ticket_number, title, description, category, priority, screenshots')
    .single()

  if (error) return { error: error.message }
  if (!ticket) return { error: 'Failed to create ticket' }

  let ticketScreenshots = parseTicketScreenshots(ticket.screenshots)
  if (imagePayload.length > 0 && driveSettingsForUpload && ticket.ticket_number) {
    const uploadResult = await uploadTicketScreenshotsToDrive(
      driveSettingsForUpload,
      ticket.ticket_number,
      imagePayload
    )
    if (!uploadResult.success) {
      await supabase.from('it_tickets').delete().eq('id', ticket.id)
      return { error: uploadResult.error }
    }

    const screenshotsStored: TicketScreenshot[] = uploadResult.files.map((f) => ({
      fileId: f.fileId,
      webViewLink: f.webViewLink ?? null,
      name: f.name,
    }))
    ticketScreenshots = screenshotsStored
    const { error: screenshotUpdateError } = await supabase.from('it_tickets').update({ screenshots: screenshotsStored }).eq('id', ticket.id)
    if (screenshotUpdateError) {
      await supabase.from('it_tickets').delete().eq('id', ticket.id)
      return { error: screenshotUpdateError.message }
    }
  }

  revalidatePath('/dashboard/operations/service-desk')
  sendNewTicketEmailToIT({ ...ticket, screenshots: ticketScreenshots }).catch(console.error)
  if (priority === 'critical') {
    sendNewCriticalTicketAlertIfEnabled(ticket).catch(console.error)
  }
  return { success: true }
}

export async function addTicketScreenshots(ticketId: string, formData: FormData) {
  const { supabase } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }

  const rawFiles = formData.getAll('screenshots').filter((s): s is File => s instanceof File && s.size > 0)
  if (rawFiles.length === 0) return { success: true }

  const { data: ticket, error: ticketError } = await supabase
    .from('it_tickets')
    .select('id, ticket_number, screenshots')
    .eq('id', ticketId)
    .single()
  if (ticketError || !ticket) return { error: ticketError?.message ?? 'Ticket not found' }

  const existingScreenshots = parseTicketScreenshots(ticket.screenshots)
  if (existingScreenshots.length + rawFiles.length > TICKET_SCREENSHOT_MAX_FILES) {
    return { error: `Max ${TICKET_SCREENSHOT_MAX_FILES} screenshots allowed per ticket.` }
  }

  const imagePayload: Array<{ buffer: Buffer; mimeType: string; fileName: string }> = []
  for (const file of rawFiles) {
    const mimeType = file.type || 'application/octet-stream'
    if (!TICKET_SCREENSHOT_MIME_TYPES.has(mimeType)) {
      return { error: 'Screenshots must be JPG, PNG, WebP, or GIF.' }
    }
    if (file.size > TICKET_SCREENSHOT_MAX_BYTES) {
      return { error: `Each screenshot must be ${TICKET_SCREENSHOT_MAX_BYTES / (1024 * 1024)} MB or smaller.` }
    }
    imagePayload.push({
      buffer: Buffer.from(await file.arrayBuffer()),
      mimeType,
      fileName: file.name || 'screenshot.png',
    })
  }

  const driveSettings = await getValidatedDriveSettings(supabase)
  if (!driveSettings) {
    return { error: 'Google Drive is required for screenshots. Please check integration settings.' }
  }

  const uploadResult = await uploadTicketScreenshotsToDrive(
    driveSettings,
    ticket.ticket_number ?? `TKT-${ticket.id.slice(0, 8)}`,
    imagePayload
  )
  if (!uploadResult.success) return { error: uploadResult.error }

  const merged: TicketScreenshot[] = [
    ...existingScreenshots,
    ...uploadResult.files.map((f) => ({ fileId: f.fileId, webViewLink: f.webViewLink ?? null, name: f.name })),
  ]

  const { error: updateError } = await supabase
    .from('it_tickets')
    .update({ screenshots: merged })
    .eq('id', ticketId)
  if (updateError) return { error: updateError.message }

  revalidatePath('/dashboard/operations/service-desk')
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
  const { supabase, userId } = await ensureAuth()
  if (!supabase) return { error: 'Not authenticated' }

  let previousStatus: string | undefined
  let createdAt: string | null | undefined
  if (formData.status != null) {
    const { data: existing } = await supabase
      .from('it_tickets')
      .select('status, ticket_number, title, created_at')
      .eq('id', id)
      .single()
    previousStatus = existing?.status
    createdAt = existing?.created_at
  }

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

  const { data: updated, error } = await supabase
    .from('it_tickets')
    .update(update)
    .eq('id', id)
    .select('ticket_number, title, status, resolved_at, resolution_notes, screenshots')
    .single()

  if (error) return { error: error.message }

  if (
    formData.status != null &&
    previousStatus != null &&
    previousStatus !== formData.status &&
    updated
  ) {
    const { data: changedByProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId ?? '')
      .single()

    const isOpenToClose = previousStatus === 'open' && formData.status === 'closed'
    const durationMs = isOpenToClose && createdAt
      ? Date.now() - new Date(createdAt).getTime()
      : undefined

    sendTicketStatusChangeEmail({
      ticketId: id,
      ticketNumber: updated.ticket_number ?? null,
      title: updated.title ?? '',
      previousStatus,
      newStatus: formData.status,
      changedBy: changedByProfile?.full_name?.trim() || 'Unknown',
      resolutionNotes: updated.resolution_notes ?? null,
      durationMs: Number.isFinite(durationMs) && (durationMs ?? 0) >= 0 ? durationMs : undefined,
      screenshots: parseTicketScreenshots(updated.screenshots),
    }).catch(console.error)
  }

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

