'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import clsx from 'clsx'

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: '/dashboard/admin/crm', label: 'Overview', exact: true },
  { href: '/dashboard/admin/crm/prospects', label: 'Prospects' },
  { href: '/dashboard/admin/crm/dealers', label: 'Dealers' },
  { href: '/dashboard/admin/crm/performance', label: 'Performance' },
  { href: '/dashboard/admin/crm/acquirers', label: 'Account acquirers' },
]

export function CrmNav() {
  const pathname = usePathname()
  const search = useSearchParams()
  const qs = search.toString()
  const suffix = qs ? `?${qs}` : ''

  return (
    <nav className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-6">
      {LINKS.map((link) => {
        const active =
          link.exact === true
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(link.href + '/')
        return (
          <Link
            key={link.href}
            href={`${link.href}${suffix}`}
            className={clsx(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white'
                : 'text-zinc-500 hover:bg-zinc-100 dark:text-gray-400 dark:hover:bg-white/5'
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}