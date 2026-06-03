'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CommNotification } from '@/lib/communication/types'
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/app/dashboard/communication/actions'

type Props = {
  initialNotifications: CommNotification[]
}

function notificationLink(n: CommNotification): string {
  const payload = n.payload as Record<string, string>
  if (payload.context === 'meet' && payload.room_id) {
    return `/dashboard/communication/meet/${payload.room_id}`
  }
  if (payload.conversation_id) {
    return `/dashboard/communication/chat?c=${payload.conversation_id}`
  }
  if (payload.room_id) {
    return `/dashboard/communication/meet/${payload.room_id}`
  }
  return '/dashboard/communication/notifications'
}

function notificationTitle(n: CommNotification): string {
  switch (n.type) {
    case 'chat_message':
      return 'New message'
    case 'meet_invite':
      return 'Meet invitation'
    case 'meet_started':
      return 'Meet started'
    case 'mention':
      return 'You were mentioned'
    default:
      return 'Notification'
  }
}

export function NotificationsContent({ initialNotifications }: Props) {
  const router = useRouter()
  const [notifications, setNotifications] = useState(initialNotifications)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const filtered =
    filter === 'unread' ? notifications.filter((n) => !n.read_at) : notifications

  const handleClick = async (n: CommNotification) => {
    if (!n.read_at) {
      await markNotificationReadAction(n.id)
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
      )
    }
    router.push(notificationLink(n))
  }

  const markAllRead = async () => {
    await markAllNotificationsReadAction()
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-zinc-500">Chat and meet activity</p>
        </div>
        <button
          type="button"
          onClick={() => void markAllRead()}
          className="text-sm text-[#C27E00] hover:underline"
        >
          Mark all read
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded px-3 py-1 text-sm ${filter === 'all' ? 'bg-[#C27E00] text-white' : 'text-zinc-600'}`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`rounded px-3 py-1 text-sm ${filter === 'unread' ? 'bg-[#C27E00] text-white' : 'text-zinc-600'}`}
        >
          Unread
        </button>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-gray-700 dark:bg-zinc-950">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">No notifications</p>
        ) : (
          <ul>
            {filtered.map((n) => {
              const payload = n.payload as Record<string, string>
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void handleClick(n)}
                    className={`flex w-full flex-col gap-1 border-b border-zinc-100 px-4 py-3 text-left last:border-0 hover:bg-zinc-50 dark:border-gray-800 dark:hover:bg-white/5 ${
                      !n.read_at ? 'bg-zinc-50/80 dark:bg-white/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{notificationTitle(n)}</span>
                      {!n.read_at && <span className="h-2 w-2 rounded-full bg-[#C27E00]" />}
                    </div>
                    {payload.preview && (
                      <p className="text-sm text-zinc-600 dark:text-gray-400 truncate">
                        {payload.preview}
                      </p>
                    )}
                    <p className="text-xs text-zinc-400">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Link href="/dashboard/communication/chat" className="text-sm text-[#C27E00] hover:underline">
        Go to Chat
      </Link>
    </div>
  )
}
