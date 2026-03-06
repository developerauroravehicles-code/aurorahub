'use client'

import { useState } from 'react'
import { createOnboardingTask } from './actions'

export function OnboardingTaskForm({
  employees,
}: {
  employees: { id: string; full_name: string | null }[]
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = e.currentTarget
    const result = await createOnboardingTask({
      profile_id: (form.elements.namedItem('profile_id') as HTMLSelectElement).value,
      title: (form.elements.namedItem('title') as HTMLInputElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value || undefined,
      due_date: (form.elements.namedItem('due_date') as HTMLInputElement).value || undefined,
    })
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      form.reset()
    }
  }

  return (
    <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Add Onboarding Task</h2>
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
        <div>
          <label className="block text-sm text-gray-400 mb-1">Task Title</label>
          <input
            type="text"
            name="title"
            required
            placeholder="e.g. Complete safety training"
            className="w-full rounded-md bg-white/5 border border-gray-700 text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
          <textarea
            name="description"
            rows={2}
            className="w-full rounded-md bg-white/5 border border-gray-700 text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Due Date (optional)</label>
          <input
            type="date"
            name="due_date"
            className="w-full rounded-md bg-white/5 border border-gray-700 text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-md bg-[#C27E00] text-white font-medium hover:bg-[#a06900] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Adding...' : 'Add Task'}
        </button>
      </form>
    </div>
  )
}
