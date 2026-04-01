'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { login } from './actions'
import { EmailInput } from '@/components/email-input'

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, null)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 p-3 rounded-md text-sm border border-red-100 dark:border-red-900/60">
          {state.error}
        </div>
      )}
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200">Dealer Code</label>
        <input
          name="dealerCode"
          required
          className="block w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-900 dark:focus:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-300 sm:text-sm"
          placeholder="e.g., KIASURREY"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200">Email</label>
        <EmailInput
          name="email"
          required
          className="block w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-900 dark:focus:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-300 sm:text-sm"
          placeholder="your.email@example.com"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200">Password</label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            className="block w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 pr-10 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-900 dark:focus:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-300 sm:text-sm"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-300"
            title={showPassword ? 'Hide password' : 'Show password'}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 flex w-full justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
