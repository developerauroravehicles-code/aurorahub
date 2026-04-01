'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { Users, Settings, FileText, BarChart3, Cog } from 'lucide-react'

export function AdminTabs() {
  const pathname = usePathname()

  const tabs = [
    { name: 'Demands', href: '/dashboard/admin/demands', icon: FileText },
    { name: 'Reports', href: '/dashboard/admin/reports', icon: BarChart3 },
    { name: 'Employees', href: '/dashboard/admin/employees', icon: Users },
    { name: 'System Management', href: '/dashboard/identity', icon: Cog },
  ]

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-200 dark:border-gray-800 mb-8">
      <nav className="flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={clsx(
                isActive
                  ? 'border-[#C27E00] text-[#C27E00]'
                  : 'border-transparent text-zinc-500 dark:text-zinc-500 dark:text-gray-400 hover:text-zinc-600 dark:text-zinc-600 dark:text-gray-300 hover:border-zinc-300 dark:border-zinc-300 dark:border-gray-600',
                'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium transition-colors'
              )}
            >
              <Icon className={clsx(
                isActive ? 'text-[#C27E00]' : 'text-zinc-500 dark:text-zinc-500 dark:text-gray-400 group-hover:text-zinc-600 dark:text-zinc-600 dark:text-gray-300',
                '-ml-0.5 mr-2 h-5 w-5'
              )} />
              {tab.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
