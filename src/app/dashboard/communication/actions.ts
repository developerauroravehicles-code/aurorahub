'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  uploadCommunicationFileToDrive,
  appendCommunicationLogToDrive,
  type GoogleDriveSettings,
} from '@/lib/google-drive'
import {
  canMessageUser,
  resolveConversationDealerId,
  canAccessDealerScope,
  filterMessageableProfiles,
  isPlatformUser,
} from '@/lib/communication/dealer-scope'
import type { CommAttachment, CommUserProfile } from '@/lib/communication/types'
import { randomBytes } from 'crypto'

const COMM_PATH = '/dashboard/communication'
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
const ATTACHMENT_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

type AuthResult =
  | { error: string; user?: undefined; profile?: undefined; supabase?: undefined }
  | { user: { id: string }; profile: CommUserProfile; supabase: Awaited<ReturnType<typeof createClient>> }

async function getAuth(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, dealer_id, role, dealer:dealers(id, name, code)')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Profile not found' }

  const dealerRaw = profile.dealer as { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null
  const dealer = Array.isArray(dealerRaw) ? dealerRaw[0] ?? null : dealerRaw

  return {
    user: { id: user.id },
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      dealer_id: profile.dealer_id,
      role: profile.role,
      dealer,
    },
    supabase,
  }
}

async function getDriveSettings(): Promise<GoogleDriveSettings | null> {
  const admin = createAdminClient()
  const { data: settingsRow } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', 'google_drive_settings')
    .single()

  if (!settingsRow?.value || typeof settingsRow.value !== 'string') return null
  try {
    return JSON.parse(settingsRow.value) as GoogleDriveSettings
  } catch {
    return null
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'meet'
}

function generateToken(): string {
  return randomBytes(16).toString('hex')
}

/** Admin DB for comm writes/reads after auth + scope checks in application code */
function getCommDb() {
  return createAdminClient()
}

async function canAccessMeetRoom(
  db: ReturnType<typeof getCommDb>,
  profile: CommUserProfile,
  roomId: string,
  room?: { host_id: string }
) {
  if (room?.host_id === profile.id) return true

  const { data: hostRow } = room
    ? { data: room }
    : await db.from('comm_meet_rooms').select('host_id').eq('id', roomId).single()

  if (hostRow?.host_id === profile.id) return true

  const { data: invite } = await db
    .from('comm_meet_invites')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (invite) return true

  const { data: participant } = await db
    .from('comm_meet_participants')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', profile.id)
    .maybeSingle()

  return !!participant
}

async function inviteUsersToMeet(
  db: ReturnType<typeof getCommDb>,
  profile: CommUserProfile,
  roomId: string,
  room: { title: string; host_id: string; join_token: string },
  userIds: string[]
) {
  const uniqueIds = [...new Set(userIds.filter((id) => id !== profile.id))]
  if (uniqueIds.length === 0) return

  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name, avatar_url, dealer_id, role')
    .in('id', uniqueIds)

  const allowed = filterMessageableProfiles(profile, (profiles ?? []) as CommUserProfile[])
  if (allowed.length === 0) return

  await db.from('comm_meet_invites').upsert(
    allowed.map((p) => ({
      room_id: roomId,
      user_id: p.id,
      invited_by: profile.id,
    })),
    { onConflict: 'room_id,user_id' }
  )

  await db.from('comm_notifications').insert(
    allowed.map((p) => ({
      user_id: p.id,
      type: 'meet_invite' as const,
      payload: {
        roomId,
        roomTitle: room.title,
        hostId: room.host_id,
        joinToken: room.join_token,
      },
    }))
  )
}

export async function getMessageableProfilesAction() {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }

  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  let query = supabase
    .from('profiles')
    .select('id, full_name, avatar_url, dealer_id, role, dealer:dealers(id, name, code)')
    .neq('id', profile.id)
    .order('full_name')

  if (!isPlatformUser(profile)) {
    query = query.or(`dealer_id.eq.${profile.dealer_id},dealer_id.is.null`)
  }

  const { data, error } = await query
  if (error) return { error: error.message }

  const mapped: CommUserProfile[] = (data ?? []).map((p) => {
    const dealerRaw = p.dealer as { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null
    return {
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      dealer_id: p.dealer_id,
      role: p.role,
      dealer: Array.isArray(dealerRaw) ? dealerRaw[0] ?? null : dealerRaw,
    }
  })

  return { profiles: filterMessageableProfiles(profile, mapped) }
}

export async function getConversationsAction() {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  const { data: memberships } = await supabase
    .from('comm_conversation_members')
    .select('conversation_id, last_read_at')
    .eq('user_id', profile.id)

  if (!memberships?.length) return { conversations: [] }

  const ids = memberships.map((m) => m.conversation_id)
  const { data: conversations, error } = await supabase
    .from('comm_conversations')
    .select('*')
    .in('id', ids)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) return { error: error.message }

  const filtered = (conversations ?? []).filter((c) => canAccessDealerScope(profile, c.dealer_id))

  const { data: allMembers } = await supabase
    .from('comm_conversation_members')
    .select('conversation_id, user_id, last_read_at, profile:profiles!user_id(id, full_name, avatar_url, dealer_id, role)')
    .in('conversation_id', ids)

  const { data: lastMessages } = await supabase
    .from('comm_messages')
    .select('conversation_id, body, created_at, sender_id')
    .in('conversation_id', ids)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const lastByConv = new Map<string, { body: string; created_at: string; sender_id: string }>()
  for (const m of lastMessages ?? []) {
    if (!lastByConv.has(m.conversation_id)) {
      lastByConv.set(m.conversation_id, m)
    }
  }

  const membersByConv = new Map<string, typeof allMembers>()
  for (const m of allMembers ?? []) {
    const list = membersByConv.get(m.conversation_id) ?? []
    list.push(m)
    membersByConv.set(m.conversation_id, list)
  }

  const readMap = new Map(memberships.map((m) => [m.conversation_id, m.last_read_at]))

  return {
    conversations: filtered.map((c) => {
      const last = lastByConv.get(c.id)
      const lastRead = readMap.get(c.id)
      const unread =
        last && (!lastRead || new Date(last.created_at) > new Date(lastRead)) && last.sender_id !== profile.id
      return {
        ...c,
        members: membersByConv.get(c.id) ?? [],
        lastMessage: last ?? null,
        unread: !!unread,
      }
    }),
  }
}

export async function getConversationMessagesAction(conversationId: string) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  const { data: conv } = await supabase.from('comm_conversations').select('*').eq('id', conversationId).single()
  if (!conv || !canAccessDealerScope(profile, conv.dealer_id)) return { error: 'Conversation not found' }

  const [{ data: messages, error }, { data: members }] = await Promise.all([
    supabase
      .from('comm_messages')
      .select('*, sender:profiles!sender_id(id, full_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('comm_conversation_members')
      .select('user_id, last_read_at, profile:profiles!user_id(id, full_name)')
      .eq('conversation_id', conversationId),
  ])

  if (error) return { error: error.message }
  return { messages: messages ?? [], members: members ?? [], conversation: conv }
}

export async function createDirectConversationAction(targetUserId: string) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  const { data: target } = await supabase
    .from('profiles')
    .select('id, dealer_id, role')
    .eq('id', targetUserId)
    .single()

  if (!target || !canMessageUser(profile, target)) return { error: 'Cannot message this user' }

  const { data: myMemberships } = await supabase
    .from('comm_conversation_members')
    .select('conversation_id')
    .eq('user_id', profile.id)

  const myConvIds = (myMemberships ?? []).map((m) => m.conversation_id)
  if (myConvIds.length) {
    const { data: shared } = await supabase
      .from('comm_conversation_members')
      .select('conversation_id')
      .eq('user_id', targetUserId)
      .in('conversation_id', myConvIds)

    for (const s of shared ?? []) {
      const { data: conv } = await supabase
        .from('comm_conversations')
        .select('*')
        .eq('id', s.conversation_id)
        .eq('type', 'direct')
        .single()
      if (conv) return { conversationId: conv.id }
    }
  }

  const dealerId = resolveConversationDealerId(profile, [profile.dealer_id, target.dealer_id])

  const { data: conv, error } = await supabase
    .from('comm_conversations')
    .insert({
      type: 'direct',
      dealer_id: dealerId,
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (error || !conv) return { error: error?.message ?? 'Failed to create conversation' }

  const { error: memberErr } = await supabase.from('comm_conversation_members').insert([
    { conversation_id: conv.id, user_id: profile.id },
    { conversation_id: conv.id, user_id: targetUserId },
  ])

  if (memberErr) return { error: memberErr.message }

  revalidatePath(`${COMM_PATH}/chat`)
  return { conversationId: conv.id }
}

export async function createGroupConversationAction(title: string, memberIds: string[]) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  const uniqueIds = [...new Set(memberIds.filter((id) => id !== profile.id))]
  if (!title.trim() || uniqueIds.length === 0) return { error: 'Title and members required' }

  const { data: targets } = await supabase.from('profiles').select('id, dealer_id, role').in('id', uniqueIds)
  for (const t of targets ?? []) {
    if (!canMessageUser(profile, t)) return { error: 'Invalid member in group' }
  }

  const dealerId = resolveConversationDealerId(
    profile,
    [profile.dealer_id, ...(targets ?? []).map((t) => t.dealer_id)]
  )

  const { data: conv, error } = await supabase
    .from('comm_conversations')
    .insert({
      type: 'group',
      title: title.trim(),
      dealer_id: dealerId,
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (error || !conv) return { error: error?.message ?? 'Failed to create group' }

  const rows = [{ conversation_id: conv.id, user_id: profile.id }, ...uniqueIds.map((id) => ({ conversation_id: conv.id, user_id: id }))]
  await supabase.from('comm_conversation_members').insert(rows)

  revalidatePath(`${COMM_PATH}/chat`)
  return { conversationId: conv.id }
}

export async function sendMessageAction(conversationId: string, body: string, attachments: CommAttachment[] = []) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  if (!body.trim() && attachments.length === 0) return { error: 'Empty message' }

  const { data: conv } = await supabase.from('comm_conversations').select('dealer_id').eq('id', conversationId).single()
  if (!conv || !canAccessDealerScope(profile, conv.dealer_id)) return { error: 'Conversation not found' }

  const { data: msg, error } = await supabase
    .from('comm_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: profile.id,
      body: body.trim(),
      attachments,
    })
    .select('*, sender:profiles!sender_id(id, full_name, avatar_url)')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`${COMM_PATH}/chat`)
  return { message: msg }
}

export async function markConversationReadAction(conversationId: string) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  await supabase
    .from('comm_conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', profile.id)

  return { success: true }
}

export async function uploadChatAttachmentAction(conversationId: string, formData: FormData) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  const { data: conv } = await supabase.from('comm_conversations').select('dealer_id').eq('id', conversationId).single()
  if (!conv || !canAccessDealerScope(profile, conv.dealer_id)) return { error: 'Conversation not found' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'No file' }
  if (file.size > ATTACHMENT_MAX_BYTES) return { error: 'File too large (max 10MB)' }
  if (!ATTACHMENT_MIME.has(file.type)) return { error: 'File type not allowed' }

  const settings = await getDriveSettings()
  if (!settings?.enabled) return { error: 'Google Drive is not configured' }

  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await uploadCommunicationFileToDrive(settings, 'chat', conversationId, {
    buffer,
    mimeType: file.type,
    fileName: file.name,
  })

  if (!result.success) return { error: result.error }

  void appendCommunicationLogToDrive(settings, {
    event: 'chat_attachment_upload',
    conversationId,
    userId: profile.id,
    fileId: result.file.fileId,
  })

  const attachment: CommAttachment = {
    fileId: result.file.fileId,
    webViewLink: result.file.webViewLink,
    name: result.file.name,
    mimeType: result.file.mimeType,
    size: result.file.size,
  }

  return { attachment }
}

// --- Meet actions ---

export async function getMeetRoomsAction() {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile } = auth as Exclude<AuthResult, { error: string }>

  const db = getCommDb()

  const [{ data: hosted }, { data: invited }, { data: joined }] = await Promise.all([
    db.from('comm_meet_rooms').select('id').eq('host_id', profile.id),
    db.from('comm_meet_invites').select('room_id').eq('user_id', profile.id),
    db.from('comm_meet_participants').select('room_id').eq('user_id', profile.id),
  ])

  const roomIds = [
    ...new Set([
      ...(hosted ?? []).map((r) => r.id),
      ...(invited ?? []).map((r) => r.room_id),
      ...(joined ?? []).map((r) => r.room_id),
    ]),
  ]

  if (roomIds.length === 0) return { rooms: [] }

  const { data, error } = await db
    .from('comm_meet_rooms')
    .select('*, host:profiles!host_id(id, full_name)')
    .in('id', roomIds)
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) return { error: error.message }
  return { rooms: data ?? [] }
}

export async function createMeetRoomAction(title: string, inviteUserIds: string[] = []) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile } = auth as Exclude<AuthResult, { error: string }>

  const roomTitle = title.trim() || `${profile.full_name ?? 'User'}'s Meet`
  const slug = `${slugify(roomTitle)}-${randomBytes(4).toString('hex')}`
  const joinToken = generateToken()

  const db = getCommDb()
  const { data: room, error } = await db
    .from('comm_meet_rooms')
    .insert({
      slug,
      join_token: joinToken,
      title: roomTitle,
      host_id: profile.id,
      dealer_id: profile.dealer_id,
      status: 'active',
    })
    .select('*, host:profiles!host_id(id, full_name)')
    .single()

  if (error || !room) return { error: error?.message ?? 'Failed to create meet' }

  await db.from('comm_meet_participants').upsert(
    {
      room_id: room.id,
      user_id: profile.id,
      joined_at: new Date().toISOString(),
      left_at: null,
    },
    { onConflict: 'room_id,user_id' }
  )

  if (inviteUserIds.length > 0) {
    await inviteUsersToMeet(db, profile, room.id, room, inviteUserIds)
  }

  const settings = await getDriveSettings()
  if (settings?.enabled) {
    void appendCommunicationLogToDrive(settings, {
      event: 'meet_created',
      roomId: room.id,
      hostId: profile.id,
      title: roomTitle,
    })
  }

  revalidatePath(`${COMM_PATH}/meet`)
  return { room }
}

export async function inviteMeetUsersAction(roomId: string, userIds: string[]) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile } = auth as Exclude<AuthResult, { error: string }>

  const db = getCommDb()
  const { data: room, error } = await db
    .from('comm_meet_rooms')
    .select('id, title, host_id, join_token, status')
    .eq('id', roomId)
    .single()

  if (error || !room) return { error: 'Meet not found' }
  if (room.status !== 'active') return { error: 'Meet not active' }
  if (!(await canAccessMeetRoom(db, profile, roomId, room))) return { error: 'Access denied' }

  const { data: activeParticipant } = await db
    .from('comm_meet_participants')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', profile.id)
    .is('left_at', null)
    .maybeSingle()

  if (!activeParticipant) return { error: 'You must be in the meet to invite others' }

  await inviteUsersToMeet(db, profile, roomId, room, userIds)
  revalidatePath(`${COMM_PATH}/meet/${roomId}`)
  revalidatePath(`${COMM_PATH}/meet`)
  return { success: true }
}

export async function joinMeetByTokenAction(token: string) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile } = auth as Exclude<AuthResult, { error: string }>

  const db = getCommDb()
  const { data: room, error } = await db
    .from('comm_meet_rooms')
    .select('*')
    .eq('join_token', token)
    .eq('status', 'active')
    .single()

  if (error || !room) return { error: 'Meet not found or ended' }

  await db.from('comm_meet_invites').upsert(
    {
      room_id: room.id,
      user_id: profile.id,
      invited_by: room.host_id,
    },
    { onConflict: 'room_id,user_id' }
  )

  await db.from('comm_meet_participants').upsert(
    {
      room_id: room.id,
      user_id: profile.id,
      joined_at: new Date().toISOString(),
      left_at: null,
    },
    { onConflict: 'room_id,user_id' }
  )

  return { roomId: room.id, slug: room.slug }
}

export async function getMeetRoomAction(roomId: string) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile } = auth as Exclude<AuthResult, { error: string }>

  const db = getCommDb()
  const { data: room, error } = await db
    .from('comm_meet_rooms')
    .select('*, host:profiles!host_id(id, full_name)')
    .eq('id', roomId)
    .single()

  if (error || !room) return { error: 'Meet not found' }
  if (!(await canAccessMeetRoom(db, profile, roomId, room))) return { error: 'Access denied' }

  if (room.status === 'active') {
    await db.from('comm_meet_participants').upsert(
      {
        room_id: roomId,
        user_id: profile.id,
        joined_at: new Date().toISOString(),
        left_at: null,
      },
      { onConflict: 'room_id,user_id' }
    )
  }

  const { data: participants } = await db
    .from('comm_meet_participants')
    .select('*, profile:profiles!user_id(id, full_name, avatar_url)')
    .eq('room_id', roomId)
    .is('left_at', null)

  return { room, participants: participants ?? [] }
}

export async function getMeetMessagesAction(roomId: string) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile } = auth as Exclude<AuthResult, { error: string }>

  const db = getCommDb()
  const { data: room } = await db
    .from('comm_meet_rooms')
    .select('dealer_id, host_id')
    .eq('id', roomId)
    .single()

  if (!room || !(await canAccessMeetRoom(db, profile, roomId, room))) return { error: 'Meet not found' }

  const { data, error } = await db
    .from('comm_meet_messages')
    .select('*, sender:profiles!sender_id(id, full_name, avatar_url)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { messages: data ?? [] }
}

export async function sendMeetMessageAction(roomId: string, body: string, attachments: CommAttachment[] = []) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile } = auth as Exclude<AuthResult, { error: string }>

  if (!body.trim() && attachments.length === 0) return { error: 'Empty message' }

  const db = getCommDb()
  const { data: room } = await db.from('comm_meet_rooms').select('status, dealer_id, host_id').eq('id', roomId).single()
  if (!room || room.status !== 'active' || !(await canAccessMeetRoom(db, profile, roomId, room))) {
    return { error: 'Meet not active' }
  }

  const { data: msg, error } = await db
    .from('comm_meet_messages')
    .insert({
      room_id: roomId,
      sender_id: profile.id,
      body: body.trim(),
      attachments,
    })
    .select('*, sender:profiles!sender_id(id, full_name, avatar_url)')
    .single()

  if (error) return { error: error.message }
  return { message: msg }
}

export async function uploadMeetAttachmentAction(roomId: string, formData: FormData) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile } = auth as Exclude<AuthResult, { error: string }>

  const db = getCommDb()
  const { data: room } = await db.from('comm_meet_rooms').select('status, dealer_id, host_id').eq('id', roomId).single()
  if (!room || room.status !== 'active' || !(await canAccessMeetRoom(db, profile, roomId, room))) {
    return { error: 'Meet not active' }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'No file' }
  if (file.size > ATTACHMENT_MAX_BYTES) return { error: 'File too large (max 10MB)' }
  if (!ATTACHMENT_MIME.has(file.type)) return { error: 'File type not allowed' }

  const settings = await getDriveSettings()
  if (!settings?.enabled) return { error: 'Google Drive is not configured' }

  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await uploadCommunicationFileToDrive(settings, 'meet', roomId, {
    buffer,
    mimeType: file.type,
    fileName: file.name,
  })

  if (!result.success) return { error: result.error }

  void appendCommunicationLogToDrive(settings, {
    event: 'meet_attachment_upload',
    roomId,
    userId: profile.id,
    fileId: result.file.fileId,
  })

  return {
    attachment: {
      fileId: result.file.fileId,
      webViewLink: result.file.webViewLink,
      name: result.file.name,
      mimeType: result.file.mimeType,
      size: result.file.size,
    } satisfies CommAttachment,
  }
}

export async function leaveMeetAction(roomId: string) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile } = auth as Exclude<AuthResult, { error: string }>

  const db = getCommDb()
  const { data: room } = await db.from('comm_meet_rooms').select('dealer_id, host_id').eq('id', roomId).single()
  if (!room || !(await canAccessMeetRoom(db, profile, roomId, room))) return { error: 'Access denied' }

  await db
    .from('comm_meet_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('user_id', profile.id)

  revalidatePath(`${COMM_PATH}/meet`)
  revalidatePath(`${COMM_PATH}/meet/${roomId}`)
  return { success: true }
}

export async function endMeetAction(roomId: string) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile } = auth as Exclude<AuthResult, { error: string }>

  const db = getCommDb()
  const { data: room } = await db.from('comm_meet_rooms').select('host_id, dealer_id').eq('id', roomId).single()
  if (!room || room.host_id !== profile.id) return { error: 'Only host can end meet' }

  await db
    .from('comm_meet_rooms')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', roomId)

  const settings = await getDriveSettings()
  if (settings?.enabled) {
    void appendCommunicationLogToDrive(settings, {
      event: 'meet_ended',
      roomId,
      hostId: profile.id,
    })
  }

  revalidatePath(`${COMM_PATH}/meet`)
  return { success: true }
}

// --- Notifications ---

export async function getNotificationsAction(unreadOnly = false) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  let query = supabase
    .from('comm_notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (unreadOnly) query = query.is('read_at', null)

  const { data, error } = await query
  if (error) return { error: error.message }
  return { notifications: data ?? [] }
}

export async function getUnreadNotificationCountAction() {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { count: 0 }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  const { count } = await supabase
    .from('comm_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .is('read_at', null)

  return { count: count ?? 0 }
}

export async function markNotificationReadAction(notificationId: string) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  await supabase
    .from('comm_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', profile.id)

  revalidatePath(`${COMM_PATH}/notifications`)
  return { success: true }
}

export async function markAllNotificationsReadAction() {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  await supabase
    .from('comm_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', profile.id)
    .is('read_at', null)

  revalidatePath(`${COMM_PATH}/notifications`)
  return { success: true }
}

export async function deleteNotificationAction(notificationId: string) {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  await supabase
    .from('comm_notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', profile.id)

  return { success: true }
}

export async function deleteAllNotificationsAction() {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  const { profile, supabase } = auth as Exclude<AuthResult, { error: string }>

  await supabase
    .from('comm_notifications')
    .delete()
    .eq('user_id', profile.id)

  return { success: true }
}

export async function getCurrentCommProfileAction() {
  const auth = await getAuth()
  if ('error' in auth && auth.error) return { error: auth.error }
  return { profile: auth.profile }
}
