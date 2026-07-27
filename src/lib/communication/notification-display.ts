import {
  AtSign,
  Bell,
  ClipboardList,
  Copy,
  Mail,
  MessageCircle,
  MessageSquareX,
  Video,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { CommNotification, CommNotificationType } from '@/lib/communication/types'

export type NotificationTypeConfig = {
  label: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  borderColor: string
}

const TYPE_CONFIG: Record<CommNotificationType, NotificationTypeConfig> = {
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
  daily_invoice_send_failed: {
    label: 'Daily invoices not delivered',
    icon: Mail,
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    iconColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-l-red-500',
  },
  daily_invoice_missed: {
    label: 'Invoices need approval',
    icon: ClipboardList,
    iconBg: 'bg-orange-100 dark:bg-orange-900/40',
    iconColor: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-l-orange-500',
  },
  service_record_pending: {
    label: 'Service record pending',
    icon: Wrench,
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-l-amber-500',
  },
  duplicate_stock_number: {
    label: 'Duplicate stock number',
    icon: Copy,
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-l-amber-500',
  },
}

const DEFAULT_CONFIG: NotificationTypeConfig = {
  label: 'Notification',
  icon: Bell,
  iconBg: 'bg-zinc-100 dark:bg-zinc-800',
  iconColor: 'text-zinc-500',
  borderColor: 'border-l-zinc-400',
}

export function getNotificationTypeConfig(type: CommNotificationType): NotificationTypeConfig {
  return TYPE_CONFIG[type] ?? DEFAULT_CONFIG
}

export function notificationLink(n: CommNotification): string {
  const p = n.payload as Record<string, string>
  if (n.type === 'daily_invoice_review' && p.link) return p.link
  if (n.type === 'daily_invoice_send_failed' && p.link) return p.link
  if (n.type === 'daily_invoice_missed' && p.link) return p.link
  if (n.type === 'service_record_pending' && p.link) return p.link
  if (n.type === 'duplicate_stock_number' && p.link) return p.link
  if (p.context === 'meet' && p.room_id) return `/dashboard/communication/meet/${p.room_id}`
  if (p.conversation_id) return `/dashboard/communication/chat?c=${p.conversation_id}`
  if (p.room_id) return `/dashboard/communication/meet/${p.room_id}`
  return '/dashboard/communication/notifications'
}

export function isMeetNotification(n: CommNotification) {
  return n.type === 'meet_invite' || n.type === 'meet_started'
}

export function getNotificationSubtitle(n: CommNotification): string | null {
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
    case 'daily_invoice_send_failed':
      return (p.message as string) || `${p.dealerName ?? 'Dealer'} daily invoices not delivered`
    case 'daily_invoice_missed':
      return (p.message as string) || `${p.unapprovedCount ?? 0} invoice(s) still need approval`
    case 'service_record_pending': {
      const diagnosis =
        (p.diagnosis as string) ||
        (p.diagnosisCode ? String(p.diagnosisCode).replace(/_/g, ' ') : '')
      const parts: string[] = []
      if (p.demandNumber) parts.push(`#${p.demandNumber}`)
      if (p.vehicleSummary) parts.push(String(p.vehicleSummary))
      if (diagnosis) parts.push(diagnosis)
      if (p.customerFirstname) parts.push(String(p.customerFirstname))
      return parts.join(' · ') || (p.message as string) || 'New customer service record pending approval'
    }
    case 'duplicate_stock_number': {
      const parts: string[] = []
      if (p.stockNumber) parts.push(String(p.stockNumber))
      if (p.demandNumber) parts.push(`Demand #${p.demandNumber}`)
      return parts.join(' · ') || (p.message as string) || 'Duplicate stock number detected'
    }
    default:
      return null
  }
}
