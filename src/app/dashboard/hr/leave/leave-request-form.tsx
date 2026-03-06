'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createLeaveRequest } from './actions'

const LEAVE_TYPES = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'parental', label: 'Parental' },
  { value: 'other', label: 'Other' },
]

export function LeaveRequestForm({
  employees,
}: {
  employees: { id: string; full_name: string | null }[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = e.currentTarget
    const formData = {
      profile_id: (form.elements.namedItem('profile_id') as HTMLSelectElement).value,
      leave_type: (form.elements.namedItem('leave_type') as HTMLSelectElement).value,
      start_date: (form.elements.namedItem('start_date') as HTMLInputElement).value,
      end_date: (form.elements.namedItem('end_date') as HTMLInputElement).value,
      notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value || undefined,
    }
    try {
      const result = await createLeaveRequest(formData)
      setLoading(false)
      if (result?.error) {
        setError(result.error)
      } else {
        form.reset()
        router.refresh()
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Create Leave Request</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Employee</label>
          <select
            name="profile_id"
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
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Leave Type</label>
            <select
              name="leave_type"
              required
              className="w-full rounded-md bg-gray-900 border border-gray-700 text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00] [&>option]:bg-gray-900 [&>option]:text-white"
              style={{ colorScheme: 'light' }}
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Start Date</label>
            <input
              type="date"
              name="start_date"
              required
              className="w-full rounded-md bg-white/5 border border-gray-700 text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">End Date</label>
            <input
              type="date"
              name="end_date"
              required
              className="w-full rounded-md bg-white/5 border border-gray-700 text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
          <textarea
            name="notes"
            rows={2}
            className="w-full rounded-md bg-white/5 border border-gray-700 text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-md bg-[#C27E00] text-white font-medium hover:bg-[#a06900] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating...' : 'Create Leave Request'}
        </button>
      </form>
    </div>
  )
}
