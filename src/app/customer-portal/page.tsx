import Link from 'next/link'
import { SystemLogo } from '@/components/system-logo'
import { FixedThemeToggle } from '@/components/fixed-theme-toggle'
import { CustomerPortalForm } from './customer-portal-form'

export default function CustomerPortalPage() {
  return (
    <div className="relative flex min-h-screen w-full">
      <FixedThemeToggle />
      <div className="hidden lg:flex w-1/2 bg-zinc-50 dark:bg-black flex-col justify-center items-center text-zinc-900 dark:text-white p-12">
        <SystemLogo />
        <p className="mt-6 max-w-md text-center text-sm text-zinc-500 dark:text-gray-400">
          View your scheduled dashcam appointment and warranty information using your vehicle VIN.
        </p>
      </div>

      <div className="flex w-full min-w-0 justify-center items-center bg-zinc-100 px-4 py-8 dark:bg-zinc-950/50 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 p-5 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Customer Portal</h1>
            <p className="text-sm text-zinc-500 dark:text-gray-500">Enter your VIN to view appointment and warranty info.</p>
          </div>
          <CustomerPortalForm />
          <div className="text-center text-sm border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <Link
              href="/login"
              className="font-medium text-zinc-900 dark:text-white underline underline-offset-2 hover:no-underline"
            >
              Dealer / staff sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
