'use client'

import { useState } from 'react'
import { updateRecruitmentPositionStatus, fillRecruitmentPosition } from './actions'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'filled', label: 'Filled' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function RecruitmentPositionActions({
  positionId,
  status,
  employees,
}: {
  positionId: string
  status: string
  employees: { id: string; full_name: string | null }[]
}) {
  const [loading, setLoading] = useState(false)
  const [showFillModal, setShowFillModal] = useState(false)

  async function handleStatusChange(newStatus: string) {
    if (newStatus === 'filled') {
      setShowFillModal(true)
      return
    }
    setLoading(true)
    await updateRecruitmentPositionStatus(positionId, newStatus)
    setLoading(false)
  }

  async function handleFillWithEmployee(profileId: string) {
    setLoading(true)
    await fillRecruitmentPosition(positionId, profileId)
    setLoading(false)
    setShowFillModal(false)
  }

  return (
    <>
      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value)}
        disabled={loading}
        className="rounded bg-gray-900 border border-gray-700 text-white text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50 [&>option]:bg-gray-900 [&>option]:text-white"
        style={{ colorScheme: 'light' }}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {showFillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Mark as Filled</h3>
            <p className="text-sm text-gray-400 mb-4">Select the employee who was hired for this position.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const sel = (e.currentTarget.elements.namedItem('employee') as HTMLSelectElement).value
                if (sel) handleFillWithEmployee(sel)
              }}
              className="space-y-4"
            >
              <select
                name="employee"
                required
                className="w-full rounded-md bg-gray-900 border border-gray-700 text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00] [&>option]:bg-gray-900 [&>option]:text-white"
                style={{ colorScheme: 'light' }}
              >
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name ?? 'Unnamed'}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowFillModal(false)}
                  className="px-4 py-2 rounded-md bg-white/5 text-white border border-gray-600 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-md bg-[#C27E00] text-white font-medium hover:bg-[#a06900] disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Mark Filled'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
