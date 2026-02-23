'use client'

import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { Image, Camera, Users, Building2, Database, Settings, MapPin, Calendar, MessageSquare } from 'lucide-react'
import Link from 'next/link'

export function SystemManagementTabs({ activeTab }: { activeTab: string }) {
  const pathname = usePathname()

  const tabs = [
    { id: 'user', name: 'User', href: '/dashboard/system-management/user', icon: Users },
    { id: 'dealer', name: 'Dealer', href: '/dashboard/system-management/dealer', icon: Building2 },
    { id: 'region', name: 'Region', href: '/dashboard/system-management/region', icon: MapPin },
    { id: 'calendar', name: 'Calendar Management', href: '/dashboard/system-management/calendar', icon: Calendar },
    { id: 'sms', name: 'SMS Management', href: '/dashboard/system-management/sms', icon: MessageSquare },
    { id: 'database', name: 'Database Management', href: '/dashboard/system-management/database', icon: Database },
    { id: 'api', name: 'API Management', href: '/dashboard/system-management/api', icon: Settings },
    { id: 'logo', name: 'Logo Management', href: '/dashboard/system-management/logo', icon: Image },
    { id: 'cameras', name: 'Camera Models', href: '/dashboard/system-management/cameras', icon: Camera },
  ]

  return (
    <div className="flex space-x-4 mb-8 border-b border-gray-800 overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = pathname === tab.href || (tab.id === activeTab)
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={clsx(
              'pb-2 text-sm font-medium transition-colors inline-flex items-center whitespace-nowrap',
              isActive
                ? 'border-b-2 border-[#C27E00] text-[#C27E00]'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            <Icon className={clsx(
              'mr-2 h-4 w-4',
              isActive ? 'text-[#C27E00]' : 'text-gray-500'
            )} />
            {tab.name}
          </Link>
        )
      })}
    </div>
  )
}
