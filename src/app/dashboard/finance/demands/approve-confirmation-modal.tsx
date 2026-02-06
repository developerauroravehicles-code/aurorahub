'use client'

import { useState } from 'react'
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
  const [sendSMSToSpecialist, setSendSMSToSpecialist] = useState(hasAssignedSpecialist)

  const handleApprove = async () => {
    if (!confirmApprove) {
      setError('Please confirm that you want to approve this demand')
      return
    }

    setLoading(true)
    setError(null)

    const result = await approveDemand(demandId, sendSMSToCustomer, sendSMSToSpecialist)
    
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h2 className="text-2xl font-semibold text-white mb-6">Approve Demand</h2>

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
                className="mt-1 w-5 h-5 rounded border-gray-700 bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-gray-900"
              />
              <label htmlFor="confirmApprove" className="text-white cursor-pointer">
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
                className="mt-1 w-5 h-5 rounded border-gray-700 bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-gray-900"
              />
              <label htmlFor="sendSMSToCustomer" className="text-white cursor-pointer">
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
                disabled={!hasAssignedSpecialist}
                className="mt-1 w-5 h-5 rounded border-gray-700 bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label 
                htmlFor="sendSMSToSpecialist" 
                className={`cursor-pointer ${!hasAssignedSpecialist ? 'text-gray-500' : 'text-white'}`}
              >
                Send information to Specialist
                {!hasAssignedSpecialist && (
                  <span className="text-xs text-gray-600 ml-2">(No specialist assigned)</span>
                )}
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
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

