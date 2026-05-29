'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateStockNumber } from './actions'

const inputClass = 'w-full border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 rounded text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]'

interface EditStockNumberFormProps {
  demandId: string
  stockNumber: string | null
  canEdit: boolean
}

export function EditStockNumberForm({
  demandId,
  stockNumber,
  canEdit,
}: EditStockNumberFormProps) {
  const router = useRouter()
  const [value, setValue] = useState(stockNumber ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const trimmed = (value || '').trim()
  const hasChange = trimmed !== (stockNumber ?? '').trim()

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    const result = await updateStockNumber(demandId, value)
    setSaving(false)
    if (result.success) {
      setMessage({ type: 'success', text: 'Stock number updated' })
      setValue(trimmed)
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Failed to update' })
    }
  }

  if (!canEdit) {
    return (
      <p className="text-zinc-900 dark:text-white">{stockNumber || '—'}</p>
    )
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        className={inputClass}
        placeholder="Stock number"
        style={{ textTransform: 'uppercase' }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChange}
          className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
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
