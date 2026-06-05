export type CommAttachment = {
  fileId: string
  webViewLink?: string | null
  name: string
  mimeType?: string
  size?: number
}

export type CommConversationType = 'direct' | 'group'

export type CommConversation = {
  id: string
  type: CommConversationType
  title: string | null
  dealer_id: string | null
  created_by: string | null
  last_message_at: string | null
  created_at: string
}

export type CommConversationMember = {
  conversation_id: string
  user_id: string
  last_read_at: string | null
  joined_at: string
  profile?: {
    id: string
    full_name: string | null
    avatar_url: string | null
    dealer_id: string | null
    role: string
  }
}

export type CommMessage = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  attachments: CommAttachment[]
  created_at: string
  edited_at: string | null
  deleted_at: string | null
  sender?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}

export type CommMeetRoom = {
  id: string
  slug: string
  join_token: string
  title: string
  host_id: string
  dealer_id: string | null
  status: 'active' | 'ended'
  started_at: string
  ended_at: string | null
  created_at: string
  host?: {
    id: string
    full_name: string | null
  }
}

export type CommMeetParticipant = {
  room_id: string
  user_id: string
  joined_at: string
  left_at: string | null
  profile?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}

export type CommMeetMessage = {
  id: string
  room_id: string
  sender_id: string
  body: string
  attachments: CommAttachment[]
  created_at: string
  sender?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}

export type CommNotificationType = 'chat_message' | 'meet_invite' | 'meet_started' | 'mention' | 'sms_pending'

export type CommNotification = {
  id: string
  user_id: string
  type: CommNotificationType
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export type CommUserProfile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  dealer_id: string | null
  role: string
  dealer?: { id: string; name: string; code: string } | null
}
