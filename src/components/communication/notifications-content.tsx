'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  Trash2,
  Bell,
  X,
  ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CommNotification, CommNotificationType } from '@/lib/communication/types'
import { subscribeToNotifications } from '@/lib/communication/realtime'
import {
  getNotificationSubtitle,
  getNotificationTypeConfig,
  isMeetNotification,
  notificationLink,
  type NotificationTypeConfig,
} from '@/lib/communication/notification-display'
import {
  deleteNotificationAction,
  deleteAllNotificationsAction,
} from '@/app/dashboard/communication/actions'

type Props = {
  initialNotifications: CommNotification[]
  currentUserId: string
}

type FilterTab = 'all' | 'unread' | 'chat' | 'meet' | 'sms'

function getConfig(type: CommNotificationType): NotificationTypeConfig {
  return getNotificationTypeConfig(type)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function groupByDate(notifications: CommNotification[]): { label: string; items: CommNotification[] }[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)

  const groups: Record<string, CommNotification[]> = {
    Today: [],
    Yesterday: [],
    'This week': [],
    Earlier: [],
  }

  for (const n of notifications) {
    const d = new Date(n.created_at)
    if (d >= todayStart) groups['Today'].push(n)
    else if (d >= yesterdayStart) groups['Yesterday'].push(n)
    else if (d >= weekStart) groups['This week'].push(n)
    else groups['Earlier'].push(n)
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }))
}

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'chat', label: 'Chat' },
  { id: 'meet', label: 'Meet' },
  { id: 'sms', label: 'SMS' },
]

// ─── component ───────────────────────────────────────────────────────────────

export function NotificationsContent({ initialNotifications, currentUserId }: Props) {
  const router = useRouter()
  const [notifications, setNotifications] = useState(initialNotifications)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [removing, setRemoving] = useState<Set<string>>(new Set())

  // Real-time sync
  useEffect(() => {
    const supabase = createClient()
    const cleanup = subscribeToNotifications(
      supabase,
      currentUserId,
      (incoming) => {
        setNotifications((prev) =>
          prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev]
        )
      },
      (deletedId) => {
        setNotifications((prev) => prev.filter((n) => n.id !== deletedId))
      }
    )
    return cleanup
  }, [currentUserId])

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      switch (filter) {
        case 'unread': return !n.read_at
        case 'chat': return n.type === 'chat_message' || n.type === 'mention'
        case 'meet': return n.type === 'meet_invite' || n.type === 'meet_started'
        case 'sms': return n.type === 'sms_pending'
        default: return true
      }
    })
  }, [notifications, filter])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const tabCount = (id: FilterTab) => {
    if (id === 'all') return notifications.length
    if (id === 'unread') return unreadCount
    if (id === 'chat') return notifications.filter((n) => n.type === 'chat_message' || n.type === 'mention').length
    if (id === 'meet') return notifications.filter((n) => n.type === 'meet_invite' || n.type === 'meet_started').length
    if (id === 'sms') return notifications.filter((n) => n.type === 'sms_pending').length
    return 0
  }

  const animateRemove = (id: string, cb: () => void) => {
    setRemoving((s) => new Set(s).add(id))
    setTimeout(cb, 220)
  }

  const handleClick = (n: CommNotification) => {
    animateRemove(n.id, () => {
      void (async () => {
        setNotifications((prev) => prev.filter((x) => x.id !== n.id))
        await deleteNotificationAction(n.id)
        const link = notificationLink(n)
        if (isMeetNotification(n)) {
          window.open(link, '_blank', 'noopener,noreferrer')
        } else {
          router.push(link)
        }
      })()
    })
  }

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    animateRemove(id, () => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      void deleteNotificationAction(id)
    })
  }

  const handleClearAll = () => {
    setNotifications([])
    void deleteAllNotificationsAction()
  }

  const groups = groupByDate(filtered)

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Notifications</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {unreadCount > 0
              ? `${unreadCount} unread · ${notifications.length} total`
              : notifications.length > 0
                ? `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`
                : "You're all caught up"}
          </p>
        </div>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:border-red-300 hover:text-red-500 dark:border-zinc-700 dark:hover:border-red-700 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900">
        {FILTER_TABS.map((tab) => {
          const count = tabCount(tab.id)
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                filter === tab.id
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                    filter === tab.id
                      ? 'bg-[#C27E00]/15 text-[#C27E00]'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Notification list */}
      {groups.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Bell className="h-7 w-7 text-zinc-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">No notifications</p>
            <p className="mt-1 text-sm text-zinc-400">
              {filter === 'all' ? "You're all caught up!" : `No ${filter} notifications`}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {groups.map(({ label, items }) => (
            <section key={label} className="flex flex-col gap-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {label}
                <span className="ml-2 font-normal normal-case text-zinc-300 dark:text-zinc-600">
                  {items.length}
                </span>
              </h2>
              <ul className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
                {items.map((n, idx) => {
                  const cfg = getConfig(n.type)
                  const Icon = cfg.icon
                  const subtitle = getNotificationSubtitle(n)
                  const isRemoving = removing.has(n.id)
                  const isMeetType = isMeetNotification(n)

                  return (
                    <li
                      key={n.id}
                      className={`group relative transition-all duration-200 ${
                        isRemoving ? 'scale-95 opacity-0' : 'opacity-100'
                      } ${idx !== 0 ? 'border-t border-zinc-100 dark:border-zinc-800' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleClick(n)}
                        className={`flex w-full items-start gap-3.5 border-l-[3px] px-4 py-4 pr-10 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03] ${
                          !n.read_at ? cfg.borderColor : 'border-l-transparent'
                        }`}
                      >
                        {/* Icon */}
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.iconBg}`}>
                          <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${!n.read_at ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
                              {cfg.label}
                            </span>
                            {!n.read_at && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C27E00]" />
                            )}
                            {isMeetType && (
                              <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400" />
                            )}
                          </div>
                          {subtitle && (
                            <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-zinc-500 dark:text-zinc-400">
                              {subtitle}
                            </p>
                          )}
                          <p className="mt-1.5 text-xs text-zinc-400">
                            {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </button>

                      {/* Dismiss button */}
                      <button
                        type="button"
                        title="Dismiss"
                        onClick={(e) => handleDismiss(e, n.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-zinc-300 opacity-0 transition-all hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
