'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNowStrict } from 'date-fns'
import { Bell, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CommNotification } from '@/lib/communication/types'
import { subscribeToNotifications } from '@/lib/communication/realtime'
import {
  getNotificationSubtitle,
  getNotificationTypeConfig,
  isMeetNotification,
  notificationLink,
} from '@/lib/communication/notification-display'
import { deleteNotificationAction } from '@/app/dashboard/communication/actions'
import { useUnreadNotificationCount } from '@/components/communication/use-unread-notifications'

const POPOVER_LIMIT = 12

type Props = {
  userId: string
}

export function DashboardNotificationBell({ userId }: Props) {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<CommNotification[]>([])
  const [loading, setLoading] = useState(false)
  const unreadCount = useUnreadNotificationCount(userId)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('comm_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(POPOVER_LIMIT)
    setNotifications((data as CommNotification[]) ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    const supabase = createClient()
    const cleanup = subscribeToNotifications(
      supabase,
      userId,
      (incoming) => {
        setNotifications((prev) =>
          prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev].slice(0, POPOVER_LIMIT)
        )
      },
      (deletedId) => {
        setNotifications((prev) => prev.filter((n) => n.id !== deletedId))
      }
    )
    return cleanup
  }, [userId])

  useEffect(() => {
    if (!open) return
    void fetchNotifications()
  }, [open, fetchNotifications])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleNotificationClick = async (n: CommNotification) => {
    setOpen(false)
    setNotifications((prev) => prev.filter((x) => x.id !== n.id))
    const result = await deleteNotificationAction(n.id)
    if (result.error) {
      void fetchNotifications()
      return
    }
    const link = notificationLink(n)
    if (isMeetNotification(n)) {
      window.open(link, '_blank', 'noopener,noreferrer')
      return
    }
    router.push(link)
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/70 text-zinc-700 shadow-sm transition-colors hover:bg-white hover:text-[#C27E00] dark:border-gray-700/80 dark:bg-black/30 dark:text-gray-200 dark:hover:bg-black/50 dark:hover:text-[#C27E00]"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C27E00] px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-gray-800">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Notifications</p>
              <p className="text-xs text-zinc-500 dark:text-gray-400">
                {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              </p>
            </div>
            <Link
              href="/dashboard/communication/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-[#C27E00] hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-gray-400">Loading…</p>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-zinc-300 dark:text-gray-600" />
                <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-gray-300">No notifications</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-gray-500">New alerts will appear here</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n, idx) => {
                  const cfg = getNotificationTypeConfig(n.type)
                  const Icon = cfg.icon
                  const subtitle = getNotificationSubtitle(n)
                  const meet = isMeetNotification(n)

                  return (
                    <li
                      key={n.id}
                      className={idx !== 0 ? 'border-t border-zinc-100 dark:border-gray-800' : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03] ${
                          !n.read_at ? `border-l-[3px] ${cfg.borderColor}` : 'border-l-[3px] border-l-transparent'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.iconBg}`}
                        >
                          <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`truncate text-sm font-semibold ${
                                !n.read_at ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'
                              }`}
                            >
                              {cfg.label}
                            </span>
                            {!n.read_at && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C27E00]" />
                            )}
                            {meet && <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400" />}
                          </div>
                          {subtitle && (
                            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-zinc-500 dark:text-gray-400">
                              {subtitle}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-zinc-400 dark:text-gray-500">
                            {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
