'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE, formatInPT } from '@/lib/timezone-defaults'
import { updateCompletedAt } from './actions'

const inputClass =
  'w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-zinc-900 p-2 rounded text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]'

function isoToPtDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  return formatInTimeZone(new Date(iso), SYSTEM_DEFAULT_TIMEZONE, "yyyy-MM-dd'T'HH:mm")
}

interface EditCompletedAtFormProps {
  demandId: string
  completedAt: string | null
  appointmentDate: string | null
  canEdit: boolean
}

export function EditCompletedAtForm({
  demandId,
  completedAt,
  appointmentDate,
  canEdit,
}: EditCompletedAtFormProps) {
  const router = useRouter()
  const [value, setValue] = useState(isoToPtDatetimeLocal(completedAt))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const trimmed = value.trim()
  const currentIso = completedAt?.trim() ?? ''
  const hasChange =
    trimmed.length > 0 &&
    (currentIso
      ? trimmed !== isoToPtDatetimeLocal(currentIso)
      : true)

  const handleSave = async () => {
    if (!trimmed) {
      setMessage({ type: 'error', text: 'Completion date is required' })
      return
    }
    setSaving(true)
    setMessage(null)
    const result = await updateCompletedAt(demandId, trimmed)
    setSaving(false)
    if (result.success) {
      setMessage({ type: 'success', text: 'Completion date updated' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Failed to update' })
    }
  }

  const handleUseAppointmentDate = () => {
    if (!appointmentDate) return
    setValue(isoToPtDatetimeLocal(appointmentDate))
    setMessage(null)
  }

  if (!canEdit) {
    return (
      <p className="text-zinc-900 dark:text-white">
        {completedAt ? formatInPT(completedAt, 'PPP h:mm a') : '—'}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {completedAt && (
        <p className="text-zinc-900 dark:text-white text-sm">
          Current: {formatInPT(completedAt, 'PPP h:mm a')}
        </p>
      )}
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setMessage(null)
        }}
        className={`${inputClass} max-w-xs dark:[color-scheme:dark]`}
        title="Entered time is interpreted as Pacific (America/Vancouver)."
      />
      <p className="text-xs text-zinc-500 dark:text-gray-400">
        Pacific time (PT) — used for statements, invoices, and reports.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChange}
          className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {appointmentDate && (
          <button
            type="button"
            onClick={handleUseAppointmentDate}
            className="px-3 py-2 text-sm rounded border border-[#C27E00]/40 bg-[#C27E00]/10 text-[#C27E00] hover:bg-[#C27E00]/20 transition-colors"
          >
            Use appointment date
          </button>
        )}
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
