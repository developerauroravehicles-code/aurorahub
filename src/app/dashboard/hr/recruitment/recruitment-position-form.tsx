'use client'

import { useState } from 'react'
import { createRecruitmentPosition } from './actions'
import { formSelectClassName } from '@/lib/form-field-styles'

// Platform roles only
const ROLES = [
  { value: 'specialist', label: 'Technical Support' },
  { value: 'aurora_manager', label: 'Aurora Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'it', label: 'IT' },
]

export function RecruitmentPositionForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = e.currentTarget
    const result = await createRecruitmentPosition({
      title: (form.elements.namedItem('title') as HTMLInputElement).value,
      role: (form.elements.namedItem('role') as HTMLSelectElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value || undefined,
    })
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      form.reset()
    }
  }

  return (
    <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Create Platform Position</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-500 dark:text-gray-400 mb-1">Title</label>
          <input
            type="text"
            name="title"
            required
            placeholder="e.g. Technical Support Specialist"
            className="w-full rounded-md bg-zinc-200/50 dark:bg-white/5 border border-zinc-300 dark:border-gray-700 text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-500 dark:text-gray-400 mb-1">Role</label>
          <select
            name="role"
            required
            className={formSelectClassName}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-zinc-500 dark:text-gray-400 mb-1">Description (optional)</label>
          <textarea
            name="description"
            rows={3}
            className="w-full rounded-md bg-zinc-200/50 dark:bg-white/5 border border-zinc-300 dark:border-gray-700 text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-md bg-[#C27E00] text-white font-medium hover:bg-[#a06900] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating...' : 'Create Position'}
        </button>
      </form>
    </div>
  )
}
