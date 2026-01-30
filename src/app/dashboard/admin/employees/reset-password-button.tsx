'use client'

import { useState } from 'react'
import { resetEmployeePassword } from './actions'
import { KeyRound, X, Check, Loader2 } from 'lucide-react'

export function ResetPasswordButton({ userId, userName }: { userId: string, userName: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
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
        className="text-gray-400 hover:text-[#C27E00] transition-colors p-1"
        title="Reset Password"
      >
        <KeyRound className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Reset Password</h3>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-sm text-gray-400 mb-4">
          Enter a new password for <span className="text-[#C27E00]">{userName}</span>.
        </p>

        {status === 'success' ? (
          <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-3 rounded flex items-center justify-center">
            <Check className="w-5 h-5 mr-2" />
            Password updated!
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password"
                className="w-full bg-black/50 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-[#C27E00]"
                required
                minLength={6}
              />
            </div>
            
            {status === 'error' && (
              <p className="text-red-400 text-sm">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-[#C27E00] hover:bg-[#a06900] text-white font-medium py-2 rounded transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

