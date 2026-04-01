'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateAssignedFinance } from './actions'

type Finance = { id: string; full_name: string | null }

interface ChangeFinanceFormProps {
  demandId: string
  currentFinanceId: string | null
  financeUsers: Finance[]
}

export function ChangeFinanceForm({
  demandId,
  currentFinanceId,
  financeUsers
}: ChangeFinanceFormProps) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string>(currentFinanceId ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSave = async () => {
    if (selectedId === (currentFinanceId ?? '')) return
    setSaving(true)
    setMessage(null)
    const result = await updateAssignedFinance(demandId, selectedId || null)
    setSaving(false)
    if (result.success) {
      setMessage({ type: 'success', text: 'Finance updated' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Failed to update' })
    }
  }

  const hasChange = selectedId !== (currentFinanceId ?? '')

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">Assigned Finance</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 rounded text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
          >
            <option value="" className="bg-zinc-50 dark:bg-black">Unassigned</option>
            {financeUsers.map(f => (
              <option key={f.id} value={f.id} className="bg-zinc-50 dark:bg-black">
                {f.full_name || 'Unknown'}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChange}
          className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          {saving ? 'Saving...' : 'Change'}
        </button>
      </div>
      {message && (
        <p
          className={`text-sm ${
            message.type === 'success' ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
