'use client'

import { useState } from 'react'
import { resetEmployeePassword } from './actions'
import { KeyRound, X, Check, Loader2, Eye, EyeOff } from 'lucide-react'

export function ResetPasswordButton({ userId, userName }: { userId: string, userName: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    const result = await resetEmployeePassword(userId, newPassword)

    if (result.error) {
      setStatus('error')
      setErrorMessage(result.error)
    } else {
      setStatus('success')
      setNewPassword('')
      setTimeout(() => {
        setIsOpen(false)
        setStatus('idle')
      }, 2000)
    }
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] transition-colors p-1"
        title="Assign Password"
      >
        <KeyRound className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] border border-zinc-200 dark:border-gray-800 rounded-lg p-6 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Assign Password</h3>
          <button onClick={() => setIsOpen(false)} className="text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">
          Assign a password for <span className="text-[#C27E00]">{userName}</span>. The user can log in with this password.
        </p>

        {status === 'success' ? (
          <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-3 rounded flex items-center justify-center">
            <Check className="w-5 h-5 mr-2" />
            Password assigned! User can now log in.
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password (min 6 characters)"
                className="w-full bg-white dark:bg-black/50 border border-zinc-300 dark:border-gray-700 rounded px-3 py-2 pr-10 text-zinc-900 dark:text-white focus:outline-none focus:border-[#C27E00]"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white p-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {status === 'error' && (
              <p className="text-red-400 text-sm">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-[#C27E00] hover:bg-[#a06900] text-white font-medium py-2 rounded transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

