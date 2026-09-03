'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { FixedThemeToggle } from '@/components/fixed-theme-toggle'
import { SystemLogo } from '@/components/system-logo'
import { completePasswordChange, validatePasswordChangeToken } from './actions'

export default function ChangePasswordClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [checking, setChecking] = useState(true)
  const [valid, setValid] = useState(false)
  const [emailHint, setEmailHint] = useState<string | null>(null)
  const [supportEmail, setSupportEmail] = useState('support@auroravehicles.com')
  const [supportPhone, setSupportPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function validate() {
      if (!token.trim()) {
        setChecking(false)
        setValid(false)
        return
      }

      const result = await validatePasswordChangeToken(token)
      if (cancelled) return

      setValid(result.valid)
      setEmailHint(result.emailHint ?? null)
      setSupportEmail(result.supportEmail ?? 'support@auroravehicles.com')
      setSupportPhone(result.supportPhone ?? '')
      setChecking(false)
    }

    void validate()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const result = await completePasswordChange(token, password)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setSuccess(true)
  }

  return (
    <div className="relative flex min-h-screen w-full">
      <FixedThemeToggle />
      <div className="hidden lg:flex w-1/2 bg-zinc-50 dark:bg-black flex-col justify-center items-center text-zinc-900 dark:text-white p-12">
        <SystemLogo />
      </div>

      <div className="flex w-full min-w-0 justify-center items-center bg-zinc-100 px-4 py-8 dark:bg-zinc-950/50 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 p-5 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Change password</h1>
            {emailHint && valid && !success && (
              <p className="mt-2 text-sm text-zinc-500 dark:text-gray-500">Account: {emailHint}</p>
            )}
          </div>

          {checking ? (
            <p className="text-center text-sm text-zinc-500 dark:text-gray-400">Checking link…</p>
          ) : success ? (
            <div className="space-y-4 text-center">
              <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200">
                Password updated. You may close this tab.
              </div>
              <Link
                href="/login"
                className="inline-flex w-full justify-center rounded-md bg-[#C27E00] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#a86a00]"
              >
                Sign in
              </Link>
            </div>
          ) : !valid ? (
            <div className="space-y-4">
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                This password change link is invalid, expired, or has already been used.
              </div>
              <p className="text-sm text-zinc-600 dark:text-gray-400">
                Contact{' '}
                <a href={`mailto:${supportEmail}`} className="text-[#C27E00] hover:underline">
                  {supportEmail}
                </a>
                {supportPhone ? (
                  <>
                    {' '}
                    or call{' '}
                    <a href={`tel:${supportPhone}`} className="text-[#C27E00] hover:underline">
                      {supportPhone}
                    </a>
                  </>
                ) : null}{' '}
                for assistance.
              </p>
              <Link
                href="/login"
                className="inline-flex w-full justify-center rounded-md border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="block w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 pr-10 text-zinc-900 dark:text-white focus:border-zinc-900 dark:focus:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-300 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200">
                  Confirm password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="block w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white focus:border-zinc-900 dark:focus:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-300 sm:text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-[#C27E00] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#a86a00] disabled:opacity-50"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
