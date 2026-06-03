'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { clsx } from 'clsx'
import { Sidebar } from './sidebar'
import { BackgroundLogo } from '@/components/background-logo'
import { TimezoneProvider } from '@/contexts/timezone-context'

interface Profile {
  id: string
  role: string
  full_name?: string | null
  dealer_id?: string | null
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className="relative flex h-screen min-w-0 max-w-[100vw] flex-col overflow-x-clip overflow-y-hidden bg-zinc-50 text-zinc-900 dark:bg-black dark:text-white md:flex-row md:overflow-hidden">
      <header className="relative z-50 flex h-14 shrink-0 items-center border-b border-zinc-200 px-3 dark:border-gray-800 md:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-200 dark:text-gray-300 dark:hover:bg-white/10"
          aria-label="Open menu"
          aria-expanded={sidebarOpen}
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="ml-2 text-sm font-semibold text-zinc-900 dark:text-white">AuroraHub</span>
      </header>

      <div className="relative flex min-h-0 w-full flex-1 flex-col md:flex-row">
        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-x-0 bottom-0 top-14 z-30 bg-black/50 md:hidden"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={clsx(
            'fixed bottom-0 left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 max-w-[85vw] transition-transform duration-200 ease-out md:static md:top-auto md:z-0 md:h-full md:max-w-none md:shrink-0 md:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          )}
        >
          <Sidebar
            profile={profile}
            timezoneName={timezoneName}
            timezoneDisplayName={timezoneDisplayName}
          />
        </div>

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
