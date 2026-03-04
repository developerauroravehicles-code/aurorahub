'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import {
  Image,
  Camera,
  Users,
  Building2,
  Database,
  Settings,
  MapPin,
  Calendar,
  MessageSquare,
  Zap,
  Mail,
  FileText,
  BookOpen,
} from 'lucide-react'
import Link from 'next/link'

const CATEGORIES = {
  organization: {
    id: 'organization',
    name: 'Organization',
    tabs: [
      { id: 'user', name: 'User', href: '/dashboard/system-management/user', icon: Users },
      { id: 'dealer', name: 'Dealer', href: '/dashboard/system-management/dealer', icon: Building2 },
      { id: 'region', name: 'Region', href: '/dashboard/system-management/region', icon: MapPin },
      { id: 'calendar', name: 'Calendar', href: '/dashboard/system-management/calendar', icon: Calendar },
    ],
  },
  communication: {
    id: 'communication',
    name: 'Communication',
    tabs: [{ id: 'sms', name: 'SMS', href: '/dashboard/system-management/sms', icon: MessageSquare }],
  },
  products: {
    id: 'products',
    name: 'Products',
    tabs: [{ id: 'cameras', name: 'Cameras', href: '/dashboard/system-management/cameras', icon: Camera }],
  },
  system: {
    id: 'system',
    name: 'System',
    tabs: [
      { id: 'database', name: 'Database', href: '/dashboard/system-management/database', icon: Database },
      { id: 'api', name: 'API', href: '/dashboard/system-management/api', icon: Settings },
      { id: 'logo', name: 'Logo', href: '/dashboard/system-management/logo', icon: Image },
      { id: 'mail', name: 'Mail Settings', href: '/dashboard/system-management/mail-settings', icon: Mail },
      { id: 'automation', name: 'Automation', href: '/dashboard/system-management/automation', icon: Zap },
      { id: 'whitepaper', name: 'Whitepaper', href: '/dashboard/system-management/whitepaper', icon: BookOpen },
    ],
  },
  logs: {
    id: 'logs',
    name: 'Logs',
    tabs: [
      { id: 'logs-sms', name: 'SMS', href: '/dashboard/system-management/logs?type=sms', icon: MessageSquare },
      { id: 'logs-mail', name: 'E-Mail', href: '/dashboard/system-management/logs?type=mail', icon: Mail },
      { id: 'logs-demands', name: 'Demand', href: '/dashboard/system-management/logs?type=demands', icon: FileText },
    ],
  },
} as const

function getCategoryAndTabFromPath(pathname: string, searchParams?: string): { categoryId: string; tabId: string } {
  const pathMap: Record<string, { categoryId: string; tabId: string }> = {
    '/dashboard/system-management/user': { categoryId: 'organization', tabId: 'user' },
    '/dashboard/system-management/dealer': { categoryId: 'organization', tabId: 'dealer' },
    '/dashboard/system-management/region': { categoryId: 'organization', tabId: 'region' },
    '/dashboard/system-management/calendar': { categoryId: 'organization', tabId: 'calendar' },
    '/dashboard/system-management/automation': { categoryId: 'system', tabId: 'automation' },
    '/dashboard/system-management/sms': { categoryId: 'communication', tabId: 'sms' },
    '/dashboard/system-management/cameras': { categoryId: 'products', tabId: 'cameras' },
    '/dashboard/system-management/database': { categoryId: 'system', tabId: 'database' },
    '/dashboard/system-management/api': { categoryId: 'system', tabId: 'api' },
    '/dashboard/system-management/logo': { categoryId: 'system', tabId: 'logo' },
    '/dashboard/system-management/mail-settings': { categoryId: 'system', tabId: 'mail' },
    '/dashboard/system-management/whitepaper': { categoryId: 'system', tabId: 'whitepaper' },
  }

  const basePath = pathname.split('?')[0]
  const direct = pathMap[basePath]
  if (direct) return direct

  if (basePath === '/dashboard/system-management/logs') {
    if (searchParams?.includes('type=demands')) return { categoryId: 'logs', tabId: 'logs-demands' }
    if (searchParams?.includes('type=mail')) return { categoryId: 'logs', tabId: 'logs-mail' }
    return { categoryId: 'logs', tabId: 'logs-sms' }
  }

  return { categoryId: 'organization', tabId: 'user' }
}

export function SystemManagementTabs({ activeTab }: { activeTab: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ''
  const { categoryId } = getCategoryAndTabFromPath(pathname, search)
  const currentCategory = CATEGORIES[categoryId as keyof typeof CATEGORIES] ?? CATEGORIES.organization

  return (
    <div className="space-y-4">
      {/* Category row */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-2">
        {Object.values(CATEGORIES).map((cat) => {
          const isActive = categoryId === cat.id
          return (
            <Link
              key={cat.id}
              href={cat.tabs[0]?.href ?? '#'}
              className={clsx(
                'px-4 py-2 rounded-t-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[#C27E00]/20 border border-b-0 border-[#C27E00]/50 text-[#C27E00] -mb-0.5'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              )}
            >
              {cat.name}
            </Link>
          )
        })}
      </div>

      {/* Tab row within category */}
      <div className="flex flex-wrap gap-2">
        {currentCategory.tabs.map((tab) => {
          const Icon = tab.icon
          const tabHref = tab.href
          const isLogsPage = pathname.includes('/logs')
          const isActive =
            tab.id === activeTab ||
            (isLogsPage && tab.id === 'logs-sms' && searchParams?.get('type') === 'sms') ||
            (isLogsPage && tab.id === 'logs-mail' && searchParams?.get('type') === 'mail') ||
            (isLogsPage && tab.id === 'logs-demands' && searchParams?.get('type') === 'demands')

          return (
            <Link
              key={`${currentCategory.id}-${tab.id}-${tab.name}`}
              href={tabHref}
              className={clsx(
                'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[#C27E00] text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              )}
            >
              <Icon className={clsx('h-4 w-4', isActive ? 'text-white' : 'text-gray-500')} />
              {tab.name}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
