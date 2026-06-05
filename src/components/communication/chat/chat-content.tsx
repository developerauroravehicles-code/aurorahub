'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { subscribeToConversation, subscribeToConversationMembers } from '@/lib/communication/realtime'
import type { CommMessage, CommUserProfile, CommConversation } from '@/lib/communication/types'
import { ConversationList } from '@/components/communication/chat/conversation-list'
import { MessageThread, MessageComposer } from '@/components/communication/chat/message-composer'
import { NewChatDialog } from '@/components/communication/chat/new-chat-dialog'
import {
  getConversationsAction,
  getConversationMessagesAction,
  getMessageableProfilesAction,
  markConversationReadAction,
} from '@/app/dashboard/communication/actions'

/** userId → { lastReadAt, fullName } */
export type MemberReadMap = Map<string, { lastReadAt: string | null; fullName: string | null }>

export type ConversationListItem = CommConversation & {
  members: Array<{
    user_id: string
    last_read_at?: string | null
    profile?: { id: string; full_name: string | null; avatar_url: string | null } | null
  }>
  lastMessage: { body: string; created_at: string; sender_id: string } | null
  unread: boolean
}

type Props = {
  currentUserId: string
  initialConversations: ConversationListItem[]
  initialProfiles: CommUserProfile[]
}

export function ChatContent({ currentUserId, initialConversations, initialProfiles }: Props) {
  const searchParams = useSearchParams()
  const conversationFromUrl = searchParams.get('c')

  const [conversations, setConversations] = useState(initialConversations)
  const [profiles] = useState(initialProfiles)
  const [activeId, setActiveId] = useState<string | null>(
    conversationFromUrl ?? initialConversations[0]?.id ?? null
  )
  const [messages, setMessages] = useState<CommMessage[]>([])
  const [memberReadMap, setMemberReadMap] = useState<MemberReadMap>(new Map())
  const [showNew, setShowNew] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)

  useEffect(() => {
    if (conversationFromUrl) setActiveId(conversationFromUrl)
  }, [conversationFromUrl])

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true)
    const res = await getConversationMessagesAction(conversationId)
    setLoadingMessages(false)
    if ('messages' in res && res.messages) {
      setMessages(res.messages as CommMessage[])
    }
    if ('members' in res && res.members) {
      const map: MemberReadMap = new Map()
      for (const m of res.members as Array<{ user_id: string; last_read_at: string | null; profile?: { full_name?: string | null } | null }>) {
        map.set(m.user_id, { lastReadAt: m.last_read_at, fullName: m.profile?.full_name ?? null })
      }
      setMemberReadMap(map)
    }
    void markConversationReadAction(conversationId)
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unread: false } : c))
    )
  }, [])

  useEffect(() => {
    if (activeId) void loadMessages(activeId)
  }, [activeId, loadMessages])

  // Subscribe to incoming messages
  useEffect(() => {
    if (!activeId) return
    const supabase = createClient()
    return subscribeToConversation(supabase, activeId, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      if (msg.sender_id !== currentUserId) {
        void markConversationReadAction(activeId)
      }
    })
  }, [activeId, currentUserId])

  // Subscribe to member read-time changes (görüldü / seen receipt updates)
  useEffect(() => {
    if (!activeId) return
    const supabase = createClient()
    return subscribeToConversationMembers(supabase, activeId, ({ user_id, last_read_at }) => {
      setMemberReadMap((prev) => {
        const next = new Map(prev)
        const existing = next.get(user_id)
        next.set(user_id, { lastReadAt: last_read_at, fullName: existing?.fullName ?? null })
        return next
      })
      // Also refresh unread state in conversation list
      if (user_id === currentUserId) {
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, unread: false } : c))
        )
      }
    })
  }, [activeId, currentUserId])

  const refreshConversations = async () => {
    const res = await getConversationsAction()
    if ('conversations' in res && res.conversations) {
      setConversations(res.conversations as ConversationListItem[])
    }
  }

  const handleSelect = (id: string) => setActiveId(id)

  const handleCreated = async (conversationId: string) => {
    await refreshConversations()
    setActiveId(conversationId)
  }

  const handleMessageSent = (message: CommMessage) => {
    setMessages((prev) => [...prev, message])
    void refreshConversations()
  }

  const activeConv = conversations.find((c) => c.id === activeId)
  const activeTitle =
    activeConv?.type === 'group' && activeConv.title
      ? activeConv.title
      : activeConv?.members.find((m) => m.user_id !== currentUserId)?.profile?.full_name ?? 'Chat'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Chat</h1>
        <p className="text-sm text-zinc-500">Direct messages and group conversations</p>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-gray-700 dark:bg-zinc-950">
        {/* Left: conversation list */}
        <div className="flex w-full max-w-xs shrink-0 flex-col border-r border-zinc-200 dark:border-gray-700 md:w-80">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-gray-700">
            <span className="text-sm font-semibold">Conversations</span>
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="rounded-md p-1.5 text-[#C27E00] hover:bg-zinc-100 dark:hover:bg-white/10"
              aria-label="New chat"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            currentUserId={currentUserId}
            onSelect={handleSelect}
          />
        </div>

        {/* Right: active chat */}
        <div className="flex min-w-0 flex-1 flex-col">
          {activeId ? (
            <>
              <div className="border-b border-zinc-200 px-4 py-3 dark:border-gray-700">
                <h2 className="font-semibold">{activeTitle}</h2>
              </div>
              {loadingMessages ? (
                <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
                  Loading messages...
                </div>
              ) : (
                <MessageThread messages={messages} currentUserId={currentUserId} memberReadMap={memberReadMap} />
              )}
              <MessageComposer
                conversationId={activeId}
                messages={messages}
                currentUserId={currentUserId}
                onMessageSent={handleMessageSent}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-zinc-500">
              Select a conversation or start a new chat
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <NewChatDialog
          profiles={profiles}
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
