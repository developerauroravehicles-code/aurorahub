'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveLeaveRequest, rejectLeaveRequest } from './actions'

export function LeaveActions({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleApprove() {
    setLoading('approve')
    await approveLeaveRequest(requestId)
    setLoading(null)
    router.refresh()
  }

  async function handleReject() {
    setLoading('reject')
    await rejectLeaveRequest(requestId)
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleApprove}
        disabled={!!loading}
        className="px-2 py-1 text-xs rounded bg-green-900/50 text-green-300 border border-green-800 hover:bg-green-800/50 disabled:opacity-50"
      >
        {loading === 'approve' ? '...' : 'Approve'}
      </button>
      <button
        onClick={handleReject}
        disabled={!!loading}
        className="px-2 py-1 text-xs rounded bg-red-900/50 text-red-300 border border-red-800 hover:bg-red-800/50 disabled:opacity-50"
      >
        {loading === 'reject' ? '...' : 'Reject'}
      </button>
    </div>
  )
}
