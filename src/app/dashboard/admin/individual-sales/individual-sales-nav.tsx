'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

const links = [
  { href: '/dashboard/admin/individual-sales/demands', label: 'Appointments' },
  { href: '/dashboard/admin/individual-sales/customers', label: 'Customers' },
  { href: '/dashboard/admin/individual-sales/invoices', label: 'Invoices' },
] as const

export function IndividualSalesNav() {
  const pathname = usePathname()
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-zinc-200 pb-3 dark:border-gray-800">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[#C27E00]/15 text-[#a06900] dark:text-[#C27E00]'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-gray-400 dark:hover:bg-white/5'
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}