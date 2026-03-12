'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { login } from './actions'

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, null)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
          {state.error}
        </div>
      )}
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900">Dealer Code</label>
        <input
          name="dealerCode"
          required
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
          placeholder="e.g., KIASURREY"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900">Email</label>
        <input
          name="email"
          type="email"
          required
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
          placeholder="your.email@example.com"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900">Password</label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-black"
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
        className="mt-6 flex w-full justify-center rounded-md bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
