'use client'

import { useState } from 'react'
import { updateOnboardingTaskStatus, deleteOnboardingTask } from './actions'

export function OnboardingTaskActions({
  taskId,
  status,
}: {
  taskId: string
  status: string
}) {
  const [loading, setLoading] = useState(false)

  async function handleStatusChange(newStatus: string) {
    setLoading(true)
    await updateOnboardingTaskStatus(taskId, newStatus)
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return
    setLoading(true)
    await deleteOnboardingTask(taskId)
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2">
      {status !== 'completed' && (
        <button
          onClick={() => handleStatusChange(status === 'pending' ? 'in_progress' : 'completed')}
          disabled={loading}
          className="px-2 py-1 text-xs rounded bg-[#C27E00]/20 text-[#C27E00] border border-[#C27E00]/50 hover:bg-[#C27E00]/30 disabled:opacity-50"
        >
          {status === 'pending' ? 'Start' : 'Complete'}
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="px-2 py-1 text-xs rounded bg-red-900/30 text-red-400 border border-red-800/50 hover:bg-red-900/50 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  )
}
