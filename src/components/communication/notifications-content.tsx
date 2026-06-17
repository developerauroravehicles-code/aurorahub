'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  MessageCircle,
  Video,
  AtSign,
  MessageSquareX,
  Trash2,
  Bell,
  X,
  ExternalLink,
  ClipboardList,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CommNotification, CommNotificationType } from '@/lib/communication/types'
import { subscribeToNotifications } from '@/lib/communication/realtime'
import {
  deleteNotificationAction,
  deleteAllNotificationsAction,
} from '@/app/dashboard/communication/actions'

type Props = {
  initialNotifications: CommNotification[]
  currentUserId: string
}

type FilterTab = 'all' | 'unread' | 'chat' | 'meet' | 'sms'

// ─── type config ─────────────────────────────────────────────────────────────

type TypeConfig = {
  label: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  borderColor: string
}

const TYPE_CONFIG: Record<CommNotificationType, TypeConfig> = {
  chat_message: {
    label: 'New message',
    icon: MessageCircle,
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-l-blue-500',
  },
  mention: {
    label: 'You were mentioned',
    icon: AtSign,
    iconBg: 'bg-orange-100 dark:bg-orange-900/40',
    iconColor: 'text-orange-600 dark:text-orange-400',
    borderColor: 'border-l-orange-500',
  },
  meet_invite: {
    label: 'Meet invitation',
    icon: Video,
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-l-purple-500',
  },
  meet_started: {
    label: 'Meet started',
    icon: Video,
    iconBg: 'bg-green-100 dark:bg-green-900/40',
    iconColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-l-green-500',
  },
  sms_pending: {
    label: 'SMS not sent',
    icon: MessageSquareX,
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    iconColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-l-red-500',
  },
  daily_invoice_review: {
    label: 'Daily invoices ready',
    icon: ClipboardList,
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-l-amber-500',
  },
}

const DEFAULT_CONFIG: TypeConfig = {
  label: 'Notification',
  icon: Bell,
  iconBg: 'bg-zinc-100 dark:bg-zinc-800',
  iconColor: 'text-zinc-500',
  borderColor: 'border-l-zinc-400',
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function getConfig(type: CommNotificationType): TypeConfig {
  return TYPE_CONFIG[type] ?? DEFAULT_CONFIG
}

function notificationLink(n: CommNotification): string {
  const p = n.payload as Record<string, string>
  if (n.type === 'daily_invoice_review' && p.link) return p.link
  if (p.context === 'meet' && p.room_id) return `/dashboard/communication/meet/${p.room_id}`
  if (p.conversation_id) return `/dashboard/communication/chat?c=${p.conversation_id}`
  if (p.room_id) return `/dashboard/communication/meet/${p.room_id}`
  return '/dashboard/communication/notifications'
}

function isMeet(n: CommNotification) {
  return n.type === 'meet_invite' || n.type === 'meet_started'
}

function getSubtitle(n: CommNotification): string | null {
  const p = n.payload as Record<string, string>
  switch (n.type) {
    case 'chat_message':
    case 'mention':
      if (p.sender_name && p.preview) return `${p.sender_name}: ${p.preview}`
      if (p.preview) return p.preview
      if (p.sender_name) return `From ${p.sender_name}`
      return null
    case 'meet_invite':
      if (p.room_title && p.inviter_name) return `${p.inviter_name} invited you to "${p.room_title}"`
      if (p.room_title) return `"${p.room_title}"`
      return null
    case 'meet_started':
      if (p.room_title && p.host_name) return `${p.host_name} started "${p.room_title}"`
      if (p.room_title) return `"${p.room_title}"`
      return null
    case 'sms_pending': {
      const parts: string[] = []
      if (p.messageType) parts.push(p.messageType.replace(/_/g, ' '))
      if (p.reason) parts.push(p.reason)
      if (p.demandId) parts.push(`Demand #${p.demandId.slice(0, 8)}`)
      return parts.join(' · ') || null
    }
    case 'daily_invoice_review':
      return (p.message as string) || `${p.dealerCount ?? 0} dealer list(s) ready for review`
    default:
      return null
  }
}

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
      setNotifications((prev) => prev.filter((x) => x.id !== n.id))
      void deleteNotificationAction(n.id)
      const link = notificationLink(n)
      if (isMeet(n)) {
        window.open(link, '_blank', 'noopener,noreferrer')
      } else {
        router.push(link)
      }
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
                  const subtitle = getSubtitle(n)
                  const isRemoving = removing.has(n.id)
                  const isMeetType = isMeet(n)

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
