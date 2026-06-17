'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { LogOut, LayoutDashboard, FileText, Users, Settings, Receipt, CalendarDays, Briefcase, ClipboardList, Wrench, GraduationCap, Clock, DollarSign, Shield, ShieldCheck, TrendingUp, Package, BarChart3, UserCircle, Cpu, MapPin, Building2, Camera, Database, Mail, Zap, Image, BookOpen, MessageSquare, Ticket, ChevronDown, ChevronRight, UserCog, Webhook, Globe, Plug, Activity, Bell, ListTodo, History, UsersRound, MessageCircle, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DealerClock } from '@/components/dealer-clock'
import { ThemeToggle } from '@/components/theme-toggle'
import { canAccessAdminCustomers, isInventoryManager, normalizeUserRole } from '@/lib/inventory-manager-access'
import { useUnreadNotificationCount } from '@/components/communication/use-unread-notifications'

interface Profile {
  id: string
  role: string
  full_name?: string | null
  dealer_id?: string | null
}

interface NavLink {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  title: string
  links: NavLink[]
}

export function Sidebar({ 
  profile, 
  timezoneName = null, 
  timezoneDisplayName 
}: { 
  profile: Profile
  timezoneName?: string | null
  timezoneDisplayName?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    identity: true,
    infrastructure: true,
    integrations: true,
    observability: true,
    operations: true,
    configuration: true,
    platform: true,
    communication: true,
  })
  const unreadCount = useUnreadNotificationCount(profile.id)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const role = normalizeUserRole(profile.role)
  const links: NavLink[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  ]

  const adminDemandsLink: NavLink = { name: 'Demands', href: '/dashboard/admin/demands', icon: FileText }
  const adminCustomersLink: NavLink = { name: 'Customers', href: '/dashboard/admin/customers', icon: UserCircle }

  // IT Role: New structure
  const itSections: NavSection[] = [
    {
      title: 'IDENTITY',
      links: [
        { name: 'Overview', href: '/dashboard/identity', icon: Users },
        { name: 'Users', href: '/dashboard/identity/users', icon: Users },
        { name: 'Groups', href: '/dashboard/identity/groups', icon: UsersRound },
        { name: 'Roles', href: '/dashboard/identity/roles', icon: UserCog },
        { name: 'Permissions', href: '/dashboard/identity/permissions', icon: ShieldCheck },
        { name: 'Sessions', href: '/dashboard/identity/sessions', icon: History },
      ],
    },
    {
      title: 'INFRASTRUCTURE',
      links: [
        { name: 'Database', href: '/dashboard/infrastructure/database', icon: Database },
        { name: 'Automation', href: '/dashboard/infrastructure/automation', icon: Zap },
        { name: 'Mail', href: '/dashboard/infrastructure/mail', icon: Mail },
        { name: 'SMS', href: '/dashboard/infrastructure/sms', icon: MessageSquare },
      ],
    },
    {
      title: 'INTEGRATIONS',
      links: [
        { name: 'Webhooks', href: '/dashboard/integrations/webhooks', icon: Webhook },
        { name: 'External APIs', href: '/dashboard/integrations/external-apis', icon: Globe },
        { name: 'Third Party Services', href: '/dashboard/integrations/third-party', icon: Plug },
      ],
    },
    {
      title: 'OBSERVABILITY',
      links: [
        { name: 'Logs', href: '/dashboard/observability/logs', icon: FileText },
        { name: 'Monitoring', href: '/dashboard/observability/monitoring', icon: Activity },
        { name: 'Alerts', href: '/dashboard/observability/alerts', icon: Bell },
      ],
    },
    {
      title: 'OPERATIONS',
      links: [
        { name: 'Service Desk', href: '/dashboard/operations/service-desk', icon: Ticket },
        { name: 'Incidents', href: '/dashboard/operations/service-desk?tab=incidents', icon: Ticket },
        { name: 'Tasks', href: '/dashboard/operations/tasks', icon: ListTodo },
      ],
    },
    {
      title: 'CONFIGURATION',
      links: [
        { name: 'Branding', href: '/dashboard/configuration/branding', icon: Image },
        { name: 'Documents', href: '/dashboard/configuration/documents', icon: BookOpen },
        { name: 'Platform Settings', href: '/dashboard/configuration/settings', icon: Settings },
        { name: 'Dealers', href: '/dashboard/configuration/dealers', icon: Building2 },
        { name: 'Region', href: '/dashboard/configuration/region', icon: MapPin },
        { name: 'Calendar', href: '/dashboard/configuration/calendar', icon: CalendarDays },
        { name: 'Cameras', href: '/dashboard/configuration/cameras', icon: Camera },
      ],
    },
  ]

  if (role === 'sales') {
    links.push({ name: 'Demands', href: '/dashboard/sales/demands', icon: FileText })
    links.push({ name: 'Reports', href: '/dashboard/sales/reports', icon: FileText })
  } else if (role === 'finance') {
    links.push({ name: 'Demands', href: '/dashboard/finance/demands', icon: FileText })
    links.push({ name: 'Reports', href: '/dashboard/finance/reports', icon: FileText })
  } else if (role === 'specialist') {
    links.push({ name: 'Work List', href: '/dashboard/specialist/work', icon: FileText })
    links.push({ name: 'Reports', href: '/dashboard/specialist/reports', icon: FileText })
  } else if (role === 'hr') {
    links.push({ name: 'Personnel Registry', href: '/dashboard/hr/personnel', icon: Users })
    links.push({ name: 'Installer Network', href: '/dashboard/hr/installers', icon: Wrench })
    links.push({ name: 'Employees', href: '/dashboard/hr/employees', icon: Users })
    links.push({ name: 'Leave', href: '/dashboard/hr/leave', icon: CalendarDays })
    links.push({ name: 'Recruitment', href: '/dashboard/hr/recruitment', icon: Briefcase })
    links.push({ name: 'Onboarding', href: '/dashboard/hr/onboarding', icon: ClipboardList })
    links.push({ name: 'Training', href: '/dashboard/hr/training', icon: GraduationCap })
    links.push({ name: 'Scheduling', href: '/dashboard/hr/scheduling', icon: Clock })
    links.push({ name: 'Payroll', href: '/dashboard/hr/payroll', icon: DollarSign })
    links.push({ name: 'Compliance', href: '/dashboard/hr/compliance', icon: Shield })
    links.push({ name: 'Performance', href: '/dashboard/hr/performance', icon: TrendingUp })
    links.push({ name: 'Equipment', href: '/dashboard/hr/equipment', icon: Package })
    links.push({ name: 'Analytics', href: '/dashboard/hr/analytics', icon: BarChart3 })
  } else if (role === 'it') {
    // IT: Platform + Dealers (handled in nav render below)
  } else if (isInventoryManager(role)) {
    links.push(adminDemandsLink, adminCustomersLink)
  } else if (role === 'aurora_manager' || role === 'general_manager') {
    links.push(adminDemandsLink)
    links.push({ name: 'Reports', href: '/dashboard/admin/reports', icon: FileText })
    if (role === 'aurora_manager') {
      links.push({ name: 'Employees', href: '/dashboard/admin/employees', icon: Users })
      links.push(adminCustomersLink)
    }
    links.push({ name: 'Invoice', href: '/dashboard/admin/invoices', icon: Receipt })
    if (role === 'aurora_manager') {
      links.push({ name: 'Daily Invoices', href: '/dashboard/admin/daily-invoices', icon: ClipboardList })
    }
    links.push({ name: 'Statement', href: '/dashboard/admin/statements', icon: FileText })
    if (role === 'aurora_manager') {
      links.push({ name: 'Inventory', href: '/dashboard/admin/inventory', icon: Package })
      links.push({ name: 'Service Desk', href: '/dashboard/operations/service-desk', icon: Ticket })
      links.push({ name: 'Leave', href: '/dashboard/hr/leave', icon: CalendarDays })
    }
  }

  // Platform Manager (Aurora) sections - Dealers, Region, Calendar, etc.
  const platformSections: NavSection[] = [
    {
      title: 'PLATFORM MANAGEMENT',
      links: [
        { name: 'Dealers', href: '/dashboard/configuration/dealers', icon: Building2 },
        { name: 'Region', href: '/dashboard/configuration/region', icon: MapPin },
        { name: 'Calendar', href: '/dashboard/configuration/calendar', icon: CalendarDays },
        { name: 'Cameras', href: '/dashboard/configuration/cameras', icon: Camera },
        { name: 'Settings', href: '/dashboard/configuration/settings', icon: Settings },
        { name: 'Branding', href: '/dashboard/configuration/branding', icon: Image },
        { name: 'Documents', href: '/dashboard/configuration/documents', icon: BookOpen },
      ],
    },
  ]

  const communicationLinks: NavLink[] = [
    { name: 'Chat', href: '/dashboard/communication/chat', icon: MessageCircle },
    { name: 'Meet', href: '/dashboard/communication/meet', icon: Video },
    { name: 'Notifications', href: '/dashboard/communication/notifications', icon: Bell },
  ]

  const renderCommunicationSection = () => {
    const sectionKey = 'communication'
    const isExpanded = expandedSections[sectionKey] ?? true
    return (
      <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-gray-800">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-gray-500 hover:text-zinc-600 dark:text-gray-300"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
          COMMUNICATION
        </button>
        {isExpanded && (
          <div className="mt-1 space-y-0.5">
            {communicationLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname.startsWith(link.href.split('?')[0])
              const showBadge = link.name === 'Notifications' && unreadCount > 0
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={clsx(
                    isActive ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-gray-400 hover:bg-zinc-200/50 dark:bg-white/5 hover:text-zinc-900 dark:text-white',
                    'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ml-1'
                  )}
                >
                  <Icon className={clsx("mr-2 h-4 w-4 flex-shrink-0", isActive ? "text-[#C27E00]" : "text-zinc-500 dark:text-gray-500 group-hover:text-zinc-600 dark:text-gray-300")} />
                  <span className="flex-1">{link.name}</span>
                  {showBadge && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C27E00] px-1.5 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-gray-800 dark:bg-black dark:text-white">
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Dealer Clock - Top of Sidebar */}
        {timezoneName && (
          <div className="px-4 pt-6 pb-4 border-b border-zinc-200 dark:border-gray-800">
            <DealerClock timezoneName={timezoneName} timezoneDisplayName={timezoneDisplayName} />
          </div>
        )}
        
        <nav className="flex-1 space-y-1 px-4 py-6">
          {role === 'it' ? (
            <>
              {links.map((link) => {
                const Icon = link.icon
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={clsx(
                      pathname.startsWith(link.href) && link.href !== '/dashboard' || (pathname === '/dashboard' && link.href === '/dashboard')
                        ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white'
                        : 'text-zinc-500 dark:text-gray-400 hover:bg-zinc-200/50 dark:bg-white/5 hover:text-zinc-900 dark:text-white',
                      'group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors'
                    )}
                  >
                    <Icon className={clsx(
                      "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                      pathname.startsWith(link.href) ? "text-[#C27E00]" : "text-zinc-500 dark:text-gray-500 group-hover:text-zinc-600 dark:text-gray-300"
                    )} />
                    {link.name}
                  </Link>
                )
              })}
              {itSections.map((sec) => {
                const sectionKey = sec.title.toLowerCase().replace(/\s+/g, '')
                const isExpanded = expandedSections[sectionKey] ?? true
                return (
                  <div key={sec.title} className="pt-2 mt-2 border-t border-zinc-200 dark:border-gray-800">
                    <button
                      onClick={() => toggleSection(sectionKey)}
                      className="flex items-center w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-gray-500 hover:text-zinc-600 dark:text-gray-300"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                      {sec.title}
                    </button>
                    {isExpanded && (
                      <div className="mt-1 space-y-0.5">
                        {sec.links.map((link) => {
                          const Icon = link.icon
                          const isActive = pathname.startsWith(link.href.split('?')[0])
                          return (
                            <Link
                              key={link.name}
                              href={link.href}
                              className={clsx(
                                isActive ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-gray-400 hover:bg-zinc-200/50 dark:bg-white/5 hover:text-zinc-900 dark:text-white',
                                'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ml-1'
                              )}
                            >
                              <Icon className={clsx("mr-2 h-4 w-4 flex-shrink-0", isActive ? "text-[#C27E00]" : "text-zinc-500 dark:text-gray-500 group-hover:text-zinc-600 dark:text-gray-300")} />
                              {link.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {renderCommunicationSection()}
            </>
          ) : role === 'aurora_manager' ? (
            <>
              {links.map((link) => {
                const Icon = link.icon
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={clsx(
                      pathname.startsWith(link.href) && link.href !== '/dashboard' || (pathname === '/dashboard' && link.href === '/dashboard')
                        ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white'
                        : 'text-zinc-500 dark:text-gray-400 hover:bg-zinc-200/50 dark:bg-white/5 hover:text-zinc-900 dark:text-white',
                      'group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors'
                    )}
                  >
                    <Icon className={clsx(
                      "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                      pathname.startsWith(link.href) ? "text-[#C27E00]" : "text-zinc-500 dark:text-gray-500 group-hover:text-zinc-600 dark:text-gray-300"
                    )} />
                    {link.name}
                  </Link>
                )
              })}
              {platformSections.map((sec) => {
                const sectionKey = 'platform'
                const isExpanded = expandedSections[sectionKey] ?? true
                return (
                  <div key={sec.title} className="pt-2 mt-2 border-t border-zinc-200 dark:border-gray-800">
                    <button
                      onClick={() => toggleSection(sectionKey)}
                      className="flex items-center w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-gray-500 hover:text-zinc-600 dark:text-gray-300"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                      {sec.title}
                    </button>
                    {isExpanded && (
                      <div className="mt-1 space-y-0.5">
                        {sec.links.map((link) => {
                          const Icon = link.icon
                          const isActive = pathname.startsWith(link.href.split('?')[0])
                          return (
                            <Link
                              key={link.name}
                              href={link.href}
                              className={clsx(
                                isActive ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-gray-400 hover:bg-zinc-200/50 dark:bg-white/5 hover:text-zinc-900 dark:text-white',
                                'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ml-1'
                              )}
                            >
                              <Icon className={clsx("mr-2 h-4 w-4 flex-shrink-0", isActive ? "text-[#C27E00]" : "text-zinc-500 dark:text-gray-500 group-hover:text-zinc-600 dark:text-gray-300")} />
                              {link.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {renderCommunicationSection()}
            </>
          ) : (
            <>
            {links.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={clsx(
                    pathname.startsWith(link.href) && link.href !== '/dashboard' || (pathname === '/dashboard' && link.href === '/dashboard')
                      ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white'
                      : 'text-zinc-500 dark:text-gray-400 hover:bg-zinc-200/50 dark:bg-white/5 hover:text-zinc-900 dark:text-white',
                    'group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors'
                  )}
                >
                  <Icon className={clsx(
                    "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                    pathname.startsWith(link.href) ? "text-[#C27E00]" : "text-zinc-500 dark:text-gray-500 group-hover:text-zinc-600 dark:text-gray-300"
                  )} />
                  {link.name}
                </Link>
              )
            })}
            {renderCommunicationSection()}
            </>
          )}
        </nav>
      </div>
      <div className="border-t border-zinc-200 dark:border-gray-800 p-6">
        {!profile.dealer_id && (
          <Link
            href="/dashboard/self"
            className={clsx(
              'flex items-center gap-2 w-full rounded-md px-3 py-2 mb-4 text-sm font-medium transition-colors',
              pathname.startsWith('/dashboard/self')
                ? 'bg-zinc-200 dark:bg-white/10 text-[#C27E00]'
                : 'text-zinc-500 dark:text-gray-400 hover:bg-zinc-200/50 dark:bg-white/5 hover:text-zinc-900 dark:text-white'
            )}
          >
            <UserCircle className="h-5 w-5 flex-shrink-0" />
            Self Portal
          </Link>
        )}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">{profile.full_name || 'User'}</p>
            <p className="text-xs font-medium text-zinc-500 dark:text-gray-500 capitalize">
              {role === 'specialist'
                ? 'Technical Support'
                : role === 'inventory_manager'
                  ? 'Inventory Manager'
                  : role?.replace(/_/g, ' ')}
            </p>
          </div>
          <ThemeToggle className="shrink-0" />
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center rounded-md bg-zinc-200/50 dark:bg-white/5 border border-zinc-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-gray-300 hover:bg-zinc-200 dark:bg-white/10 hover:text-zinc-900 dark:text-white transition-colors"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  )
}

