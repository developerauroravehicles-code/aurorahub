'use client'

import { useState, useRef } from 'react'
import { approveDemand } from './actions'
import { useRouter } from 'next/navigation'

interface ApproveConfirmationModalProps {
  demandId: string
  isOpen: boolean
  onClose: () => void
  hasAssignedSpecialist?: boolean
}

export function ApproveConfirmationModal({ demandId, isOpen, onClose, hasAssignedSpecialist = false }: ApproveConfirmationModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [sendSMSToCustomer, setSendSMSToCustomer] = useState(true)
  // Auto-check specialist SMS since demand will be auto-assigned to dealer's specialist when approved
  const [sendSMSToSpecialist, setSendSMSToSpecialist] = useState(true)
  const [sendSMSToAuroraManager, setSendSMSToAuroraManager] = useState(true)
  const submittingRef = useRef(false)

  const handleApprove = async () => {
    if (!confirmApprove) {
      setError('Please confirm that you want to approve this demand')
      return
    }
    if (submittingRef.current) return
    submittingRef.current = true

    setLoading(true)
    setError(null)

    const result = await approveDemand(demandId, sendSMSToCustomer, sendSMSToSpecialist, sendSMSToAuroraManager)
    
    submittingRef.current = false
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.refresh()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-white dark:bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-200 dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6">Approve Demand</h2>

          {error && (
            <div className="bg-red-900/50 border border-red-800 text-red-200 p-4 rounded-md mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Approve Confirmation */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="confirmApprove"
                checked={confirmApprove}
                onChange={(e) => setConfirmApprove(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-gray-900"
              />
              <label htmlFor="confirmApprove" className="text-zinc-900 dark:text-white cursor-pointer">
                Are you sure you want to approve this demand?
              </label>
            </div>

            {/* Customer SMS Confirmation */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="sendSMSToCustomer"
                checked={sendSMSToCustomer}
                onChange={(e) => setSendSMSToCustomer(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-gray-900"
              />
              <label htmlFor="sendSMSToCustomer" className="text-zinc-900 dark:text-white cursor-pointer">
                Send appointment information to customer via SMS
              </label>
            </div>

            {/* Specialist SMS Confirmation */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="sendSMSToSpecialist"
                checked={sendSMSToSpecialist}
                onChange={(e) => setSendSMSToSpecialist(e.target.checked)}
                disabled
                className="mt-1 w-5 h-5 rounded border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-gray-900 disabled:opacity-75 disabled:cursor-not-allowed"
              />
              <label htmlFor="sendSMSToSpecialist" className="text-zinc-900 dark:text-white cursor-not-allowed opacity-75">
                Send information to Specialist
                <span className="text-xs text-zinc-500 dark:text-gray-500 ml-2">(Will be auto-assigned to dealer's specialist)</span>
              </label>
            </div>

            {/* Aurora Manager SMS Confirmation */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="sendSMSToAuroraManager"
                checked={sendSMSToAuroraManager}
                onChange={(e) => setSendSMSToAuroraManager(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-gray-900"
              />
              <label htmlFor="sendSMSToAuroraManager" className="text-zinc-900 dark:text-white cursor-pointer">
                Send demand created notification to Aurora Manager(s)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-200 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-zinc-600 dark:text-gray-300 hover:text-zinc-900 dark:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={loading || !confirmApprove}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 transition-colors"
            >
              {loading ? 'Approving...' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

