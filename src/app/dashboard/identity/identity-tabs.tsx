'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { clsx } from 'clsx'
import { Users, UsersRound, UserCog, ShieldCheck, History } from 'lucide-react'

const TABS = [
  { id: 'overview', name: 'Overview', href: '/dashboard/identity', icon: Users },
  { id: 'users', name: 'Users', href: '/dashboard/identity/users', icon: Users },
  { id: 'groups', name: 'Groups', href: '/dashboard/identity/groups', icon: UsersRound },
  { id: 'roles', name: 'Roles', href: '/dashboard/identity/roles', icon: UserCog },
  { id: 'permissions', name: 'Permissions', href: '/dashboard/identity/permissions', icon: ShieldCheck },
  { id: 'sessions', name: 'Session History', href: '/dashboard/identity/sessions', icon: History },
] as const

export function IdentityTabs() {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-gray-800 pb-4 mb-4">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive =
          (tab.id === 'overview' && pathname === '/dashboard/identity') ||
          (tab.id !== 'overview' && pathname?.startsWith(tab.href))

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={clsx(
              'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              isActive ? 'bg-[#C27E00] text-white' : 'text-zinc-500 dark:text-gray-500 hover:text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5'
            )}
          >
            <Icon className={clsx('h-4 w-4', isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-gray-500')} />
            {tab.name}
          </Link>
        )
      })}
    </div>
  )
}
