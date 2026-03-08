'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateVinLast6 } from './actions'

const inputClass = 'w-full border border-gray-700 bg-white/5 p-2 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]'

interface EditVinFormProps {
  demandId: string
  vinLast6: string | null
  isAuroraManager: boolean
}

export function EditVinForm({
  demandId,
  vinLast6,
  isAuroraManager,
}: EditVinFormProps) {
  const router = useRouter()
  const [value, setValue] = useState(vinLast6 ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const normalized = (value || '').trim().replace(/\s/g, '').slice(-6).toUpperCase()
  const hasChange = normalized !== (vinLast6 ?? '').trim().toUpperCase()
  const isValid = normalized.length >= 6

  const handleSave = async () => {
    if (normalized.length < 6) {
      setMessage({ type: 'error', text: 'VIN last 6 digits is required (exactly 6 characters)' })
      return
    }
    setSaving(true)
    setMessage(null)
    const result = await updateVinLast6(demandId, value)
    setSaving(false)
    if (result.success) {
      setMessage({ type: 'success', text: 'VIN updated' })
      setValue(normalized)
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Failed to update' })
    }
  }

  if (!isAuroraManager) {
    return (
      <p className="text-white">{vinLast6 ? vinLast6.toUpperCase() : '—'}</p>
    )
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={inputClass}
        placeholder="Last 6 digits"
        maxLength={17}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChange || !isValid}
          className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <span className="text-xs text-gray-500">Full VIN or last 6 digits</span>
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
