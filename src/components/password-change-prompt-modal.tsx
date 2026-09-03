'use client'

import { useEffect, useState } from 'react'
import {
  dismissPasswordPrompt,
  getPasswordPromptState,
  sendPasswordChangeEmail,
} from '@/app/dashboard/password-prompt/actions'

const SESSION_KEY = 'aurora-password-prompt-shown'

export function PasswordChangePromptModal() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [supportEmail, setSupportEmail] = useState('support@auroravehicles.com')
  const [supportPhone, setSupportPhone] = useState('')
  const [dismissedInfo, setDismissedInfo] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) return

      const state = await getPasswordPromptState()
      if (cancelled) return

      setSupportEmail(state.supportEmail)
      setSupportPhone(state.supportPhone)

      if (state.show) {
        setOpen(true)
        sessionStorage.setItem(SESSION_KEY, '1')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const closeModal = () => {
    setOpen(false)
    setError(null)
    setSuccessMessage(null)
    setDismissedInfo(false)
  }

  const handleYes = async () => {
    setLoading(true)
    setError(null)
    const result = await sendPasswordChangeEmail()
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setSuccessMessage('Check your email for a secure link (opens in a new tab).')
  }

  const handleNo = async () => {
    setLoading(true)
    setError(null)
    const result = await dismissPasswordPrompt()
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setDismissedInfo(true)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
        role="dialog"
        aria-labelledby="password-prompt-title"
        aria-modal="true"
      >
        <div className="p-6">
          <h2 id="password-prompt-title" className="mb-2 text-xl font-semibold text-zinc-900 dark:text-white">
            Password security
          </h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-gray-300">
            Would you like to change your password?
          </p>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200">
              {successMessage}
            </div>
          )}

          {dismissedInfo && (
            <div className="mb-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-gray-700 dark:bg-black/40 dark:text-gray-300">
              <p>You can continue using AuroraHub. To change your password later, contact IT:</p>
              <p className="mt-2">
                <a href={`mailto:${supportEmail}`} className="text-[#C27E00] hover:underline">
                  {supportEmail}
                </a>
                {supportPhone ? (
                  <>
                    {' '}
                    ·{' '}
                    <a href={`tel:${supportPhone}`} className="text-[#C27E00] hover:underline">
                      {supportPhone}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {!successMessage && !dismissedInfo && (
              <>
                <button
                  type="button"
                  onClick={handleNo}
                  disabled={loading}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5"
                >
                  No, not now
                </button>
                <button
                  type="button"
                  onClick={handleYes}
                  disabled={loading}
                  className="rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white hover:bg-[#a86a00] disabled:opacity-50"
                >
                  {loading ? 'Sending…' : 'Yes, send me a link'}
                </button>
              </>
            )}
            {(successMessage || dismissedInfo) && (
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white hover:bg-[#a86a00]"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
