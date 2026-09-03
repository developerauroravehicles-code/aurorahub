import { Suspense } from 'react'
import { SystemLogo } from '@/components/system-logo'
import { FixedThemeToggle } from '@/components/fixed-theme-toggle'
import ChangePasswordClient from './change-password-client'

export default function ChangePasswordPage() {
  return (
    <div className="relative flex min-h-screen w-full">
      <FixedThemeToggle />
      <div className="hidden lg:flex w-1/2 bg-zinc-50 dark:bg-black flex-col justify-center items-center text-zinc-900 dark:text-white p-12">
        <SystemLogo />
      </div>

      <div className="flex w-full min-w-0 justify-center items-center bg-zinc-100 px-4 py-8 dark:bg-zinc-950/50 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 p-5 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 sm:p-8">
          <Suspense
            fallback={
              <p className="text-center text-sm text-zinc-500 dark:text-gray-400">Loading…</p>
            }
          >
            <ChangePasswordClient />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
