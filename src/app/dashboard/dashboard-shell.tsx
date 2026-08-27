'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronRight, Menu } from 'lucide-react'
import { clsx } from 'clsx'
import { Sidebar } from './sidebar'
import { BackgroundLogo } from '@/components/background-logo'
import { TimezoneProvider } from '@/contexts/timezone-context'

const SIDEBAR_STORAGE_KEY = 'aurora-sidebar-expanded'

interface Profile {
  id: string
  role: string
  full_name?: string | null
  dealer_id?: string | null
  jobTitle?: string | null
}

export function DashboardShell({
  profile,
  timezoneName = null,
  timezoneDisplayName,
  children,
}: {
  profile: Profile
  timezoneName?: string | null
  timezoneDisplayName?: string
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopExpanded, setDesktopExpanded] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (stored !== null) setDesktopExpanded(stored === 'true')
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const toggleDesktopSidebar = () => {
    setDesktopExpanded((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <div className="relative flex h-screen min-w-0 max-w-[100vw] flex-col overflow-x-clip overflow-y-hidden bg-zinc-50 text-zinc-900 dark:bg-black dark:text-white md:flex-row md:overflow-hidden">
      <header className="relative z-50 flex h-14 shrink-0 items-center border-b border-zinc-200 px-3 dark:border-gray-800 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-200 dark:text-gray-300 dark:hover:bg-white/10"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="ml-2 text-sm font-semibold text-zinc-900 dark:text-white">AuroraHub</span>
      </header>

      <div className="relative flex min-h-0 w-full flex-1 flex-col md:flex-row">
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-x-0 bottom-0 top-14 z-30 bg-black/50 md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <div
          className={clsx(
            'fixed bottom-0 left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 max-w-[85vw] transition-all duration-200 ease-out md:static md:top-auto md:z-0 md:h-full md:max-w-none',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
            desktopExpanded
              ? 'md:w-64 md:translate-x-0 md:shrink-0'
              : 'md:w-0 md:-translate-x-full md:overflow-hidden md:shrink-0'
          )}
        >
          <Sidebar
            profile={profile}
            timezoneName={timezoneName}
            timezoneDisplayName={timezoneDisplayName}
            onToggleCollapse={toggleDesktopSidebar}
            onCloseMobile={() => setMobileOpen(false)}
          />
        </div>

        {!desktopExpanded && (
          <button
            type="button"
            onClick={toggleDesktopSidebar}
            className="fixed left-0 top-1/2 z-50 hidden -translate-y-1/2 md:flex h-12 w-7 items-center justify-center rounded-r-lg border border-l-0 border-zinc-200 bg-zinc-50 text-zinc-600 shadow-md hover:bg-zinc-100 dark:border-gray-700 dark:bg-black dark:text-gray-300 dark:hover:bg-white/10"
            aria-label="Open sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        <TimezoneProvider timezoneName={timezoneName}>
          <main className="relative z-10 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-zinc-50 px-4 py-4 dark:bg-black md:px-8 md:py-8">
            {children}
          </main>
        </TimezoneProvider>
      </div>

      <BackgroundLogo />
    </div>
  )
}
