'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { buildCrmSnapshot } from '@/lib/crm/load-crm-data'
import { parseCrmPeriodFromSearchParams } from '@/lib/crm/period'
import { canSetDealerAcquired } from '@/lib/crm/acquired'
import { computeRemindAtFromMeeting, type FollowUpKind } from '@/lib/crm/follow-up'
import { ptDatetimeLocalToISO } from '@/lib/timezone-defaults'
import { fetchProspectCrmDetail, listCrmProspects } from '@/lib/crm/load-prospect'

export type CrmNoteOwner =
  | { type: 'dealer'; dealerId: string }
  | { type: 'prospect'; prospectId: string }

function revalidateCrmOwner(owner: CrmNoteOwner) {
  if (owner.type === 'dealer') {
    revalidatePath(`/dashboard/admin/crm/dealers/${owner.dealerId}`)
  } else {
    revalidatePath(`/dashboard/admin/crm/prospects/${owner.prospectId}`)
    revalidatePath('/dashboard/admin/crm/prospects')
  }
}

export async function ensureAuroraManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, userId: null, supabase: null }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') {
    return { error: 'Only Aurora Manager can access CRM.' as const, userId: null, supabase: null }
  }

  return { error: null, userId: user.id, supabase }
}

export async function getCrmSnapshot(year?: string, quarter?: string) {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase) return { error: auth.error }

  const period = parseCrmPeriodFromSearchParams(year, quarter)
  try {
    const snapshot = await buildCrmSnapshot(auth.supabase, period)
    return { snapshot }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load CRM data.' }
  }
}

export async function listAcquirerCandidates() {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase) return { error: auth.error, profiles: [] as { id: string; full_name: string | null }[] }

  const { data } = await auth.supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['aurora_manager', 'sales'])
    .order('full_name')

  return { profiles: data ?? [] }
}

export async function setDealerAcquired(dealerId: string, acquirerProfileId: string) {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase || !auth.userId) return { error: auth.error ?? 'Unauthorized' }

  const { data: existing } = await auth.supabase
    .from('dealers')
    .select('acquired_by_profile_id')
    .eq('id', dealerId)
    .single()

  if (!canSetDealerAcquired(existing?.acquired_by_profile_id)) {
    return { error: 'Account acquirer is already set and cannot be changed.' }
  }

  const { error } = await auth.supabase
    .from('dealers')
    .update({
      acquired_by_profile_id: acquirerProfileId,
      acquired_at: new Date().toISOString(),
    })
    .eq('id', dealerId)
    .is('acquired_by_profile_id', null)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/admin/crm/dealers/${dealerId}`)
  revalidatePath('/dashboard/admin/crm/acquirers')
  return { success: true }
}

export async function updateDealerCrmContact(
  dealerId: string,
  input: { primary_contact_name?: string; primary_contact_email?: string }
) {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const { error } = await auth.supabase
    .from('dealers')
    .update({
      primary_contact_name: input.primary_contact_name?.trim() || null,
      primary_contact_email: input.primary_contact_email?.trim() || null,
    })
    .eq('id', dealerId)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/admin/crm/dealers/${dealerId}`)
  return { success: true }
}

export async function listCrmProspectsAction() {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase) return { error: auth.error, prospects: [] }

  try {
    const prospects = await listCrmProspects(auth.supabase)
    return { prospects }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load prospects.' }
  }
}

export async function createCrmProspect(input: {
  name: string
  primary_contact_name?: string
  primary_contact_email?: string
  phone?: string
  address?: string
  initialNote?: string
  meetingAtLocal?: string
}) {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase || !auth.userId) return { error: auth.error ?? 'Unauthorized' }

  const name = input.name.trim()
  if (!name) return { error: 'Company or dealer name is required.' }

  const { data: row, error } = await auth.supabase
    .from('crm_prospects')
    .insert({
      name,
      primary_contact_name: input.primary_contact_name?.trim() || null,
      primary_contact_email: input.primary_contact_email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      status: 'prospect',
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (error || !row) return { error: error?.message ?? 'Could not create prospect.' }

  if (input.initialNote?.trim()) {
    await createCrmNote({ type: 'prospect', prospectId: row.id }, input.initialNote, input.meetingAtLocal)
  }

  revalidatePath('/dashboard/admin/crm/prospects')
  return { success: true, prospectId: row.id as string }
}

export async function updateCrmProspect(
  prospectId: string,
  input: {
    name?: string
    primary_contact_name?: string
    primary_contact_email?: string
    phone?: string
    address?: string
    status?: 'prospect' | 'qualified' | 'won' | 'lost'
  }
) {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const { error } = await auth.supabase
    .from('crm_prospects')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/admin/crm/prospects/${prospectId}`)
  revalidatePath('/dashboard/admin/crm/prospects')
  return { success: true }
}

export async function createCrmNote(owner: CrmNoteOwner, body: string, meetingAtLocal?: string) {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase || !auth.userId) return { error: auth.error ?? 'Unauthorized' }

  const trimmed = body.trim()
  if (!trimmed) return { error: 'Note cannot be empty.' }

  let meeting_at: string | null = null
  if (meetingAtLocal?.trim()) {
    meeting_at = ptDatetimeLocalToISO(meetingAtLocal.trim())
    if (Number.isNaN(new Date(meeting_at).getTime())) {
      return { error: 'Enter a valid meeting date and time.' }
    }
  }

  const insertRow =
    owner.type === 'dealer'
      ? { dealer_id: owner.dealerId, body: trimmed, meeting_at, created_by: auth.userId }
      : { prospect_id: owner.prospectId, body: trimmed, meeting_at, created_by: auth.userId }

  const { data, error } = await auth.supabase
    .from('dealer_crm_notes')
    .insert(insertRow)
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (owner.type === 'prospect') {
    await auth.supabase
      .from('crm_prospects')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', owner.prospectId)
  }

  revalidateCrmOwner(owner)
  return { success: true, noteId: data.id }
}

/** @deprecated use createCrmNote */
export async function createDealerCrmNote(dealerId: string, body: string, meetingAtLocal?: string) {
  return createCrmNote({ type: 'dealer', dealerId }, body, meetingAtLocal)
}

export async function createNoteEmailReminder(input: {
  owner: CrmNoteOwner
  noteId: string
  recipientEmail: string
  subject?: string
  followUpKind: FollowUpKind
  meetingAtLocal?: string
  customRemindAtLocal?: string
}) {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase || !auth.userId) return { error: auth.error ?? 'Unauthorized' }

  const email = input.recipientEmail.trim().toLowerCase()
  if (!email.includes('@')) return { error: 'Enter a valid email address.' }

  const { data: note } = await auth.supabase
    .from('dealer_crm_notes')
    .select('id, meeting_at')
    .eq('id', input.noteId)
    .single()

  if (!note) return { error: 'Note not found.' }

  let meetingAtIso = note.meeting_at as string | null
  if (!meetingAtIso && input.meetingAtLocal?.trim()) {
    meetingAtIso = ptDatetimeLocalToISO(input.meetingAtLocal.trim())
    await auth.supabase.from('dealer_crm_notes').update({ meeting_at: meetingAtIso }).eq('id', input.noteId)
  }

  let remindAt: Date
  let followUpKind = input.followUpKind

  if (input.followUpKind === 'custom') {
    if (!input.customRemindAtLocal?.trim()) {
      return { error: 'Choose a custom follow-up date and time.' }
    }
    const iso = ptDatetimeLocalToISO(input.customRemindAtLocal.trim())
    remindAt = new Date(iso)
    if (Number.isNaN(remindAt.getTime())) {
      return { error: 'Invalid custom reminder time.' }
    }
  } else if (input.followUpKind === 'legacy_date') {
    return { error: 'Use a meeting-based follow-up option.' }
  } else {
    if (!meetingAtIso) {
      return { error: 'Set a meeting date & time on the note (or in the follow-up form) first.' }
    }
    try {
      remindAt = computeRemindAtFromMeeting(meetingAtIso, input.followUpKind)
    } catch {
      return { error: 'Could not compute follow-up time from meeting.' }
    }
  }

  if (remindAt.getTime() < Date.now() - 60_000) {
    return { error: 'Follow-up time is in the past. Choose a future meeting or offset.' }
  }

  const remind_on = remindAt.toISOString().slice(0, 10)

  const reminderRow =
    input.owner.type === 'dealer'
      ? {
          dealer_id: input.owner.dealerId,
          note_id: input.noteId,
          remind_on,
          remind_at: remindAt.toISOString(),
          follow_up_kind: followUpKind,
          recipient_email: email,
          subject: (input.subject?.trim() || 'Aurora CRM follow-up').slice(0, 200),
          status: 'pending',
          created_by: auth.userId,
        }
      : {
          prospect_id: input.owner.prospectId,
          note_id: input.noteId,
          remind_on,
          remind_at: remindAt.toISOString(),
          follow_up_kind: followUpKind,
          recipient_email: email,
          subject: (input.subject?.trim() || 'Aurora CRM follow-up').slice(0, 200),
          status: 'pending',
          created_by: auth.userId,
        }

  const { error } = await auth.supabase.from('dealer_crm_note_reminders').insert(reminderRow)

  if (error) return { error: error.message }
  revalidateCrmOwner(input.owner)
  return { success: true }
}

export async function cancelNoteReminder(reminderId: string, owner: CrmNoteOwner) {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase) return { error: auth.error ?? 'Unauthorized' }

  const { error } = await auth.supabase
    .from('dealer_crm_note_reminders')
    .update({ status: 'cancelled' })
    .eq('id', reminderId)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  revalidateCrmOwner(owner)
  return { success: true }
}

export async function getProspectCrmDetail(prospectId: string) {
  const auth = await ensureAuroraManager()
  if (auth.error || !auth.supabase) return { error: auth.error }

  const detail = await fetchProspectCrmDetail(auth.supabase, prospectId)
  if (!detail) return { error: 'Prospect not found.' }
  return { detail }
}