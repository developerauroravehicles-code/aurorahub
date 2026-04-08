'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { getCategoryNameFromPath } from './system-management-tabs'

export function SystemManagementPageTitle() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams?.toString()
  const categoryName = getCategoryNameFromPath(pathname ?? '', search)

  return (
    <h1 className="break-words text-xl font-semibold text-zinc-900 dark:text-white sm:text-2xl mb-4 sm:mb-6 pr-[env(safe-area-inset-right)]">
      {categoryName}
    </h1>
  )
}
