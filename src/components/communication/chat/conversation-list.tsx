'use client'

import { clsx } from 'clsx'

type ConversationItem = {
  id: string
  type: string
  title: string | null
  lastMessage: { body: string; created_at: string; sender_id: string } | null
  unread: boolean
  members: Array<{
    user_id: string
    profile?: { id: string; full_name: string | null; avatar_url: string | null } | null
  }>
}

type Props = {
  conversations: ConversationItem[]
  activeId: string | null
  currentUserId: string
  onSelect: (id: string) => void
}

function displayTitle(conv: ConversationItem, currentUserId: string): string {
  if (conv.type === 'group' && conv.title) return conv.title
  const other = conv.members.find((m) => m.user_id !== currentUserId)
  return other?.profile?.full_name ?? 'Direct chat'
}

export function ConversationList({ conversations, activeId, currentUserId, onSelect }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-500">
        No conversations yet. Start a new chat.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => {
        const title = displayTitle(conv, currentUserId)
        const preview = conv.lastMessage?.body ?? 'No messages yet'
        return (
          <button
            key={conv.id}
            type="button"
            onClick={() => onSelect(conv.id)}
            className={clsx(
              'flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors dark:border-gray-800',
              activeId === conv.id
                ? 'bg-zinc-100 dark:bg-white/10'
                : 'hover:bg-zinc-50 dark:hover:bg-white/5'
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium dark:bg-gray-700">
              {title.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{title}</p>
                {conv.unread && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#C27E00]" />
                )}
              </div>
              <p className="truncate text-xs text-zinc-500">{preview}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
