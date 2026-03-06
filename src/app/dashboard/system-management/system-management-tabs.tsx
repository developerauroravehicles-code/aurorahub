'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import {
  Image,
  Camera,
  Users,
  UsersRound,
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
  Ticket,
  Shield,
  UserCog,
  History,
  Webhook,
  Globe,
  Plug,
  Activity,
  Bell,
} from 'lucide-react'
import Link from 'next/link'

// Platform: categories with sub-tabs (sidebar'dan kategoriye girince sadece o kategorinin sekmeleri)
// Dealers: Dealer-specific features
const CATEGORIES = {
  platformOrganization: {
    id: 'platformOrganization',
    name: 'IDENTITY',
    tabs: [
      { id: 'overview', name: 'Overview', href: '/dashboard/identity', icon: Users },
      { id: 'users', name: 'Users', href: '/dashboard/identity/users', icon: Users },
      { id: 'groups', name: 'Groups', href: '/dashboard/identity/groups', icon: UsersRound },
      { id: 'roles', name: 'Roles', href: '/dashboard/identity/roles', icon: UserCog },
      { id: 'permissions', name: 'Permissions', href: '/dashboard/identity/permissions', icon: Shield },
      { id: 'sessions', name: 'Session History', href: '/dashboard/identity/sessions', icon: History },
      { id: 'employees', name: 'Employees', href: '/dashboard/admin/employees', icon: Users },
    ],
  },
  platformSystem: {
    id: 'platformSystem',
    name: 'Infrastructure',
    tabs: [
      { id: 'database', name: 'Database', href: '/dashboard/infrastructure/database', icon: Database },
      { id: 'automation', name: 'Automation', href: '/dashboard/infrastructure/automation', icon: Zap },
      { id: 'mail', name: 'Mail Settings', href: '/dashboard/infrastructure/mail', icon: Mail },
      { id: 'sms', name: 'SMS', href: '/dashboard/infrastructure/sms', icon: MessageSquare },
    ],
  },
  platformIntegrations: {
    id: 'platformIntegrations',
    name: 'INTEGRATIONS',
    tabs: [
      { id: 'webhooks', name: 'Webhooks', href: '/dashboard/integrations/webhooks', icon: Webhook },
      { id: 'external-apis', name: 'External APIs', href: '/dashboard/integrations/external-apis', icon: Globe },
      { id: 'third-party', name: 'Third Party Services', href: '/dashboard/integrations/third-party', icon: Plug },
    ],
  },
  platformConfiguration: {
    id: 'platformConfiguration',
    name: 'CONFIGURATION',
    tabs: [
      { id: 'logo', name: 'Branding', href: '/dashboard/configuration/branding', icon: Image },
      { id: 'whitepaper', name: 'Documents', href: '/dashboard/configuration/documents', icon: BookOpen },
      { id: 'settings', name: 'Platform Settings', href: '/dashboard/configuration/settings', icon: Settings },
    ],
  },
  platformOperations: {
    id: 'platformOperations',
    name: 'OPERATIONS',
    tabs: [
      { id: 'service-desk', name: 'Service Desk', href: '/dashboard/operations/service-desk', icon: Ticket },
      { id: 'tasks', name: 'Tasks', href: '/dashboard/operations/tasks', icon: FileText },
    ],
  },
  platformServiceDesk: {
    id: 'platformServiceDesk',
    name: 'Service Desk',
    tabs: [{ id: 'service-desk', name: 'Service Desk', href: '/dashboard/operations/service-desk', icon: Ticket }],
  },
  platformObservability: {
    id: 'platformObservability',
    name: 'OBSERVABILITY',
    tabs: [
      { id: 'logs', name: 'Logs', href: '/dashboard/observability/logs', icon: FileText },
      { id: 'monitoring', name: 'Monitoring', href: '/dashboard/observability/monitoring', icon: Activity },
      { id: 'alerts', name: 'Alerts', href: '/dashboard/observability/alerts', icon: Bell },
    ],
  },
  platformLogs: {
    id: 'platformLogs',
    name: 'Logs',
    tabs: [
      { id: 'logs-sms', name: 'SMS', href: '/dashboard/observability/logs?type=sms', icon: MessageSquare },
      { id: 'logs-mail', name: 'E-Mail', href: '/dashboard/observability/logs?type=mail', icon: Mail },
      { id: 'logs-demands', name: 'Demand', href: '/dashboard/observability/logs?type=demands', icon: FileText },
    ],
  },
  dealers: {
    id: 'dealers',
    name: 'Dealers',
    tabs: [
      { id: 'dealer', name: 'Dealers', href: '/dashboard/configuration/dealers', icon: Building2 },
      { id: 'region', name: 'Region', href: '/dashboard/configuration/region', icon: MapPin },
      { id: 'calendar', name: 'Calendar', href: '/dashboard/configuration/calendar', icon: Calendar },
      { id: 'cameras', name: 'Cameras', href: '/dashboard/configuration/cameras', icon: Camera },
    ],
  },
} as const

function getCategoryAndTabFromPath(pathname: string, searchParams?: string): { categoryId: string; tabId: string } {
  const basePath = pathname.split('?')[0]
  const pathMap: Record<string, { categoryId: string; tabId: string }> = {
    '/dashboard/identity': { categoryId: 'platformOrganization', tabId: 'overview' },
    '/dashboard/identity/users': { categoryId: 'platformOrganization', tabId: 'users' },
    '/dashboard/identity/groups': { categoryId: 'platformOrganization', tabId: 'groups' },
    '/dashboard/identity/roles': { categoryId: 'platformOrganization', tabId: 'roles' },
    '/dashboard/identity/permissions': { categoryId: 'platformOrganization', tabId: 'permissions' },
    '/dashboard/identity/sessions': { categoryId: 'platformOrganization', tabId: 'sessions' },
    '/dashboard/admin/employees': { categoryId: 'platformOrganization', tabId: 'employees' },
    '/dashboard/system-management/permissions': { categoryId: 'platformOrganization', tabId: 'permissions' },
    '/dashboard/configuration/dealers': { categoryId: 'dealers', tabId: 'dealer' },
    '/dashboard/configuration/region': { categoryId: 'dealers', tabId: 'region' },
    '/dashboard/configuration/calendar': { categoryId: 'dealers', tabId: 'calendar' },
    '/dashboard/configuration/cameras': { categoryId: 'dealers', tabId: 'cameras' },
    '/dashboard/infrastructure/sms': { categoryId: 'platformSystem', tabId: 'sms' },
    '/dashboard/infrastructure/database': { categoryId: 'platformSystem', tabId: 'database' },
    '/dashboard/infrastructure/automation': { categoryId: 'platformSystem', tabId: 'automation' },
    '/dashboard/infrastructure/mail': { categoryId: 'platformSystem', tabId: 'mail' },
    '/dashboard/integrations/webhooks': { categoryId: 'platformIntegrations', tabId: 'webhooks' },
    '/dashboard/integrations/external-apis': { categoryId: 'platformIntegrations', tabId: 'external-apis' },
    '/dashboard/integrations/third-party': { categoryId: 'platformIntegrations', tabId: 'third-party' },
    '/dashboard/configuration/branding': { categoryId: 'platformConfiguration', tabId: 'logo' },
    '/dashboard/configuration/documents': { categoryId: 'platformConfiguration', tabId: 'whitepaper' },
    '/dashboard/configuration/settings': { categoryId: 'platformConfiguration', tabId: 'settings' },
    '/dashboard/operations/service-desk': { categoryId: 'platformOperations', tabId: 'service-desk' },
    '/dashboard/operations/tasks': { categoryId: 'platformOperations', tabId: 'tasks' },
    '/dashboard/observability/monitoring': { categoryId: 'platformObservability', tabId: 'monitoring' },
    '/dashboard/observability/alerts': { categoryId: 'platformObservability', tabId: 'alerts' },
    '/dashboard/observability/logs': { categoryId: 'platformObservability', tabId: 'logs' },
  }
  if (pathMap[basePath]) return pathMap[basePath]
  if (pathname.includes('/observability/logs') || pathname.includes('/logs')) {
    if (searchParams?.includes('type=demands')) return { categoryId: 'platformLogs', tabId: 'logs-demands' }
    if (searchParams?.includes('type=mail')) return { categoryId: 'platformLogs', tabId: 'logs-mail' }
    return { categoryId: 'platformLogs', tabId: 'logs-sms' }
  }
  return { categoryId: 'platformOrganization', tabId: 'overview' }
}

export function getCategoryNameFromPath(pathname: string, searchParams?: string): string {
  const { categoryId } = getCategoryAndTabFromPath(pathname, searchParams)
  const cat = CATEGORIES[categoryId as keyof typeof CATEGORIES]
  return cat?.name ?? 'IDENTITY'
}

export function SystemManagementTabs({ activeTab, userRole }: { activeTab: string; userRole?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ''
  const { categoryId, tabId } = getCategoryAndTabFromPath(pathname, search)
  const currentCategory = CATEGORIES[categoryId as keyof typeof CATEGORIES] ?? CATEGORIES.platformOrganization
  const isDealersSection = categoryId === 'dealers'

  const tabs = currentCategory.tabs.filter(
    (tab) => !(userRole === 'it' && categoryId === 'platformOrganization' && tab.id === 'employees')
  )

  return (
    <div className="space-y-4">
      {/* Top-level: Platform | Dealers */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-2">
        <Link
          href="/dashboard/identity"
          className={clsx(
            'px-4 py-2 rounded-t-md text-sm font-medium transition-colors',
            !isDealersSection
              ? 'bg-[#C27E00]/20 border border-b-0 border-[#C27E00]/50 text-[#C27E00] -mb-0.5'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          )}
        >
          Platform
        </Link>
        <Link
          href="/dashboard/configuration/dealers"
          className={clsx(
            'px-4 py-2 rounded-t-md text-sm font-medium transition-colors',
            isDealersSection
              ? 'bg-[#C27E00]/20 border border-b-0 border-[#C27E00]/50 text-[#C27E00] -mb-0.5'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          )}
        >
          Dealers
        </Link>
      </div>

      {/* Only tabs for the current category (e.g. Infrastructure: Database | Automation | Mail | SMS) */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const resolvedTab = activeTab || tabId
          const isLogsPage = pathname.includes('/logs')
          const isActive =
            tab.id === resolvedTab ||
            (isLogsPage && tab.id === 'logs-sms' && searchParams?.get('type') === 'sms') ||
            (isLogsPage && tab.id === 'logs-mail' && searchParams?.get('type') === 'mail') ||
            (isLogsPage && tab.id === 'logs-demands' && searchParams?.get('type') === 'demands')

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={clsx(
                'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                isActive ? 'bg-[#C27E00] text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
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
