import { LoginForm } from './login-form'
import { SystemLogo } from '@/components/system-logo'
import { FixedThemeToggle } from '@/components/fixed-theme-toggle'

export default async function LoginPage() {
  return (
    <div className="relative flex min-h-screen w-full">
      <FixedThemeToggle />
      {/* Left Side - Black Background */}
      <div className="hidden lg:flex w-1/2 bg-zinc-50 dark:bg-black flex-col justify-center items-center text-zinc-900 dark:text-white p-12">
        <SystemLogo />
      </div>

      {/* Right Side - Login Form */}
      <div className="flex w-full min-w-0 justify-center items-center bg-zinc-100 px-4 py-8 dark:bg-zinc-950/50 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 p-5 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 sm:p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Aurora Hub
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-gray-500">
              Enter your dealer code, email, and password to sign in
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
