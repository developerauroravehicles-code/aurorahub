'use client'

import { useState } from 'react'
import { ISO_WEEKDAY_LABELS } from '@/lib/dealer-calendar-day-type'

type Props = {
  dealerId: string
  initialClosedIsoDays: number[]
  saveDealerWeeklyClosedDays: (
    dealerId: string,
    closedIsoDays: number[]
  ) => Promise<{ success: boolean; error?: string }>
  onError: (msg: string | null) => void
  onSuccess: (msg: string | null) => void
}

export function DealerWeeklyClosedRow({
  dealerId,
  initialClosedIsoDays,
  saveDealerWeeklyClosedDays,
  onError,
  onSuccess,
}: Props) {
  const [closed, setClosed] = useState<Set<number>>(() => new Set(initialClosedIsoDays))
  const [saving, setSaving] = useState(false)

  const toggle = (isoDow: number) => {
    setClosed(prev => {
      const next = new Set(prev)
      if (next.has(isoDow)) next.delete(isoDow)
      else next.add(isoDow)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    onError(null)
    onSuccess(null)
    const result = await saveDealerWeeklyClosedDays(dealerId, [...closed])
    setSaving(false)
    if (result.success) {
      onSuccess('Weekly closed days saved.')
      window.location.reload()
    } else {
      onError(result.error || 'Failed to save weekly closed days.')
    }
  }

  return (
    <div className="mt-6 pt-4 border-t border-zinc-300 dark:border-gray-700">
      <p className="text-sm font-medium text-zinc-600 dark:text-gray-300 mb-2">Weekly closed days</p>
      <p className="text-xs text-zinc-500 dark:text-gray-400 mb-3">
        Check each day this dealer is closed every week. No appointments can be booked on checked days.
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-3">
        {ISO_WEEKDAY_LABELS.map(({ isoDow, short }) => (
          <label key={isoDow} className="inline-flex items-center gap-2 text-sm text-zinc-800 dark:text-gray-200 cursor-pointer">
            <input
              type="checkbox"
              checked={closed.has(isoDow)}
              onChange={() => toggle(isoDow)}
              className="rounded border-zinc-400 dark:border-gray-600 text-[#C27E00] focus:ring-[#C27E00]"
            />
            {short}
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="px-4 py-2 bg-[#C27E00] text-white rounded-md hover:bg-[#a06900] transition-colors text-sm font-medium disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save closed days'}
      </button>
    </div>
  )
}
