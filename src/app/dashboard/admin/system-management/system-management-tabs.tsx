'use client'

import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { Image, Camera } from 'lucide-react'
import Link from 'next/link'

export function SystemManagementTabs({ activeTab }: { activeTab: string }) {
  const pathname = usePathname()

  const tabs = [
    { id: 'logo', name: 'Logo Management', href: '/dashboard/admin/system-management', icon: Image },
    { id: 'cameras', name: 'Camera Models', href: '/dashboard/admin/system-management/cameras', icon: Camera },
  ]

  return (
    <div className="flex space-x-4 mb-8 border-b border-gray-800">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = pathname === tab.href || (tab.id === activeTab)
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={clsx(
              'pb-2 text-sm font-medium transition-colors inline-flex items-center',
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
