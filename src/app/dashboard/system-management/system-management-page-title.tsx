'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { getCategoryNameFromPath } from './system-management-tabs'

export function SystemManagementPageTitle() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams?.toString()
  const categoryName = getCategoryNameFromPath(pathname ?? '', search)

  return (
    <h1 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-white">
      {categoryName}
    </h1>
  )
}
