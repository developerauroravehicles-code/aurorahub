'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createAvailability,
  updateAvailability,
  deleteAvailability,
  createLeaveBlock,
  updateLeaveBlock,
  deleteLeaveBlock,
} from './actions'
import { Pencil, Trash2, Plus, Calendar, Clock, Loader2 } from 'lucide-react'

const DAY_NAMES: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

function formatTime(t: string | null): string {
  if (!t) return '—'
  const [h, m] = t.split(':')
  const hh = parseInt(h ?? '0', 10)
  const mm = m ?? '0'
  if (hh === 0 && mm === '00') return '12:00 AM'
  if (hh < 12) return `${hh}:${mm.padStart(2, '0')} AM`
  if (hh === 12) return `12:${mm.padStart(2, '0')} PM`
  return `${hh - 12}:${mm.padStart(2, '0')} PM`
}

function toTimeInputValue(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  return `${(h ?? '00').padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`
}

export function SchedulingContent({
  availability,
  leaveBlocks,
  personnel,
}: {
  availability: {
    id: string
    personnel_id: string
    day_of_week: number | null
    start_time: string | null
    end_time: string | null
    is_available: boolean
    valid_from: string | null
    valid_to: string | null
    notes: string | null
    personnel: { full_name: string } | null
  }[]
  leaveBlocks: {
    id: string
    personnel_id: string
    start_date: string
    end_date: string
    reason: string | null
    personnel: { full_name: string } | null
  }[]
  personnel: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'availability' | 'leave'>('availability')
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false)
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<string | null>(null)
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('availability')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'availability'
              ? 'bg-white/10 text-white border border-b-0 border-gray-800'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Clock className="w-4 h-4" /> Availability
        </button>
        <button
          onClick={() => setActiveTab('leave')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'leave'
              ? 'bg-white/10 text-white border border-b-0 border-gray-800'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Calendar className="w-4 h-4" /> Leave Blocks
        </button>
      </div>

      {activeTab === 'availability' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Weekly Availability</h2>
            <button
              onClick={() => {
                setEditingAvailabilityId(null)
                setShowAvailabilityForm(true)
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> Add Availability
            </button>
          </div>
          {showAvailabilityForm && (
            <AvailabilityForm
              personnel={personnel}
              availability={editingAvailabilityId ? availability.find((a) => a.id === editingAvailabilityId) : null}
              onClose={() => {
                setShowAvailabilityForm(false)
                setEditingAvailabilityId(null)
              }}
              onSuccess={() => {
                router.refresh()
                setShowAvailabilityForm(false)
                setEditingAvailabilityId(null)
              }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-gray-400">Day</th>
                  <th className="px-4 py-2 text-left text-gray-400">Time</th>
                  <th className="px-4 py-2 text-left text-gray-400">Valid</th>
                  <th className="px-4 py-2 text-left text-gray-400">Available</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {availability.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 text-white">
                      <Link href={`/dashboard/hr/personnel/${a.personnel_id}`} className="text-[#C27E00] hover:underline">
                        {a.personnel?.full_name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-300">
                      {a.day_of_week != null ? DAY_NAMES[a.day_of_week] ?? `Day ${a.day_of_week}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-300">
                      {a.start_time || a.end_time
                        ? `${formatTime(a.start_time)} – ${formatTime(a.end_time)}`
                        : 'All day'}
                    </td>
                    <td className="px-4 py-2 text-gray-400">
                      {a.valid_from || a.valid_to
                        ? `${a.valid_from ? new Date(a.valid_from).toLocaleDateString() : '…'} – ${a.valid_to ? new Date(a.valid_to).toLocaleDateString() : '…'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${a.is_available ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                        {a.is_available ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => {
                          setEditingAvailabilityId(a.id)
                          setShowAvailabilityForm(true)
                        }}
                        className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete this availability?')) { await deleteAvailability(a.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete">
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {availability.length === 0 && !showAvailabilityForm && (
              <p className="text-gray-500 py-6 text-center">No availability records. Add one to define weekly schedules.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'leave' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Leave Blocks</h2>
            <button
              onClick={() => {
                setEditingLeaveId(null)
                setShowLeaveForm(true)
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> Add Leave Block
            </button>
          </div>
          {showLeaveForm && (
            <LeaveBlockForm
              personnel={personnel}
              leaveBlock={editingLeaveId ? leaveBlocks.find((l) => l.id === editingLeaveId) : null}
              onClose={() => {
                setShowLeaveForm(false)
                setEditingLeaveId(null)
              }}
              onSuccess={() => {
                router.refresh()
                setShowLeaveForm(false)
                setEditingLeaveId(null)
              }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-gray-400">Start</th>
                  <th className="px-4 py-2 text-left text-gray-400">End</th>
                  <th className="px-4 py-2 text-left text-gray-400">Reason</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {leaveBlocks.map((l) => {
                  const isPast = l.end_date < today
                  return (
                    <tr key={l.id} className={isPast ? 'opacity-60' : ''}>
                      <td className="px-4 py-2 text-white">
                        <Link href={`/dashboard/hr/personnel/${l.personnel_id}`} className="text-[#C27E00] hover:underline">
                          {l.personnel?.full_name ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-300">{new Date(l.start_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-gray-300">{new Date(l.end_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-gray-400">{l.reason || '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => {
                            setEditingLeaveId(l.id)
                            setShowLeaveForm(true)
                          }}
                          className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4 inline" />
                        </button>
                        <form action={async () => { if (confirm('Delete this leave block?')) { await deleteLeaveBlock(l.id); router.refresh() } }} className="inline">
                          <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete">
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {leaveBlocks.length === 0 && !showLeaveForm && (
              <p className="text-gray-500 py-6 text-center">No leave blocks. Add vacation, sick leave, or other absences.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AvailabilityForm({
  personnel,
  availability,
  onClose,
  onSuccess,
}: {
  personnel: { id: string; full_name: string }[]
  availability: { id: string; personnel_id: string; day_of_week: number | null; start_time: string | null; end_time: string | null; is_available: boolean; valid_from: string | null; valid_to: string | null; notes: string | null } | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!availability

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const personnelId = (form.elements.namedItem('personnel_id') as HTMLSelectElement).value
    const dayOfWeek = parseInt((form.elements.namedItem('day_of_week') as HTMLSelectElement).value, 10)
    const startTime = (form.elements.namedItem('start_time') as HTMLInputElement).value || undefined
    const endTime = (form.elements.namedItem('end_time') as HTMLInputElement).value || undefined
    const isAvailable = (form.elements.namedItem('is_available') as HTMLSelectElement).value === 'true'
    const validFrom = (form.elements.namedItem('valid_from') as HTMLInputElement).value || undefined
    const validTo = (form.elements.namedItem('valid_to') as HTMLInputElement).value || undefined
    const notes = (form.elements.namedItem('notes') as HTMLTextAreaElement).value.trim() || undefined

    if (isEdit && availability) {
      const result = await updateAvailability(availability.id, {
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        is_available: isAvailable,
        valid_from: validFrom,
        valid_to: validTo,
        notes,
      })
      if (result.error) setError(result.error)
      else onSuccess()
    } else {
      const result = await createAvailability({
        personnel_id: personnelId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        is_available: isAvailable,
        valid_from: validFrom,
        valid_to: validTo,
        notes,
      })
      if (result.error) setError(result.error)
      else onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{isEdit ? 'Edit Availability' : 'Add Availability'}</h3>
      {!isEdit && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Personnel</label>
          <select name="personnel_id" required defaultValue="" className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm [&>option]:bg-gray-900" style={{ colorScheme: 'dark' }}>
            <option value="">Select...</option>
            {personnel.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Day of Week</label>
          <select name="day_of_week" required defaultValue={String(availability?.day_of_week ?? 1)} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm [&>option]:bg-gray-900" style={{ colorScheme: 'dark' }}>
            {Object.entries(DAY_NAMES).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Available</label>
          <select name="is_available" defaultValue={availability?.is_available !== false ? 'true' : 'false'} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm [&>option]:bg-gray-900" style={{ colorScheme: 'dark' }}>
            <option value="true">Yes</option>
            <option value="false">No (unavailable)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Start Time</label>
          <input name="start_time" type="time" defaultValue={toTimeInputValue(availability?.start_time ?? null)} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">End Time</label>
          <input name="end_time" type="time" defaultValue={toTimeInputValue(availability?.end_time ?? null)} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Valid From</label>
          <input name="valid_from" type="date" defaultValue={availability?.valid_from ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Valid To</label>
          <input name="valid_to" type="date" defaultValue={availability?.valid_to ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Notes</label>
        <textarea name="notes" rows={2} defaultValue={availability?.notes ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Add')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}

function LeaveBlockForm({
  personnel,
  leaveBlock,
  onClose,
  onSuccess,
}: {
  personnel: { id: string; full_name: string }[]
  leaveBlock: { id: string; personnel_id: string; start_date: string; end_date: string; reason: string | null } | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!leaveBlock

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const personnelId = (form.elements.namedItem('personnel_id') as HTMLSelectElement).value
    const startDate = (form.elements.namedItem('start_date') as HTMLInputElement).value
    const endDate = (form.elements.namedItem('end_date') as HTMLInputElement).value
    const reason = (form.elements.namedItem('reason') as HTMLTextAreaElement).value.trim() || undefined

    if (isEdit && leaveBlock) {
      const result = await updateLeaveBlock(leaveBlock.id, { start_date: startDate, end_date: endDate, reason })
      if (result.error) setError(result.error)
      else onSuccess()
    } else {
      const result = await createLeaveBlock({ personnel_id: personnelId, start_date: startDate, end_date: endDate, reason })
      if (result.error) setError(result.error)
      else onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{isEdit ? 'Edit Leave Block' : 'Add Leave Block'}</h3>
      {!isEdit && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Personnel</label>
          <select name="personnel_id" required defaultValue="" className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm [&>option]:bg-gray-900" style={{ colorScheme: 'dark' }}>
            <option value="">Select...</option>
            {personnel.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Start Date</label>
          <input name="start_date" type="date" required defaultValue={leaveBlock?.start_date ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">End Date</label>
          <input name="end_date" type="date" required defaultValue={leaveBlock?.end_date ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Reason</label>
        <textarea name="reason" rows={2} defaultValue={leaveBlock?.reason ?? ''} placeholder="Vacation, sick leave, personal..." className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Add')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}
