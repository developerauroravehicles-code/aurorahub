'use client'

import { useState, useEffect } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { Plus, Trash2, Check, Clock, Bell } from 'lucide-react'
import {
  getManagerNotes,
  createManagerNote,
  updateManagerNote,
  deleteManagerNote,
  type ManagerNote
} from './actions'

export function ManagerNotesWidget() {
  const [notes, setNotes] = useState<ManagerNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')
  const [newReminderAt, setNewReminderAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await getManagerNotes()
    setLoading(false)
    if (res.error) setError(res.error)
    else setNotes(res.notes)
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim() || submitting) return
    setSubmitting(true)
    const res = await createManagerNote(newContent.trim(), newReminderAt || null)
    setSubmitting(false)
    if (res.error) setError(res.error)
    else {
      setNewContent('')
      setNewReminderAt('')
      load()
    }
  }

  const handleToggleDone = async (note: ManagerNote) => {
    await updateManagerNote(note.id, { is_done: !note.is_done })
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note?')) return
    await deleteManagerNote(id)
    load()
  }

  const now = new Date()
  const reminderDue = (note: ManagerNote) =>
    note.reminder_at &&
    !note.is_done &&
    new Date(note.reminder_at) <= new Date(now.getTime() + 24 * 60 * 60 * 1000)

  if (error) {
    return (
      <div className="bg-zinc-200/50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Notes & Reminders</h2>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-200/50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Notes & Reminders</h2>
      </div>

      <form onSubmit={handleAdd} className="mb-4 flex flex-col gap-2">
        <input
          type="text"
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="Add a note..."
          className="w-full px-3 py-2 bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
          disabled={submitting}
        />
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-2 sm:items-center">
          <input
            type="datetime-local"
            value={newReminderAt}
            onChange={e => setNewReminderAt(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 rounded-lg text-zinc-900 dark:text-white text-sm focus:ring-1 focus:ring-[#C27E00]"
            title="Entered time is saved as Pacific (America/Vancouver), same as appointments."
          />
          <button
            type="submit"
            disabled={!newContent.trim() || submitting}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#C27E00] hover:bg-[#a06900] text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        <p className="text-xs text-zinc-500 dark:text-gray-500">
          Reminder time is interpreted as Pacific (PT) and stored in UTC — same as the rest of AuroraHub.
        </p>
      </form>

      {loading ? (
        <p className="text-zinc-500 dark:text-gray-500 text-sm">Loading...</p>
      ) : notes.length === 0 ? (
        <p className="text-zinc-500 dark:text-gray-500 text-sm">No notes yet. Add one above.</p>
      ) : (
        <ul className="space-y-2 max-h-[280px] overflow-y-auto">
          {notes.map(note => (
            <li
              key={note.id}
              className={`p-3 rounded-lg border transition-colors ${
                note.is_done
                  ? 'bg-zinc-50 dark:bg-black/20 border-zinc-200 dark:border-gray-800 opacity-75'
                  : reminderDue(note)
                    ? 'bg-amber-900/30 border-amber-700'
                    : 'bg-zinc-50 dark:bg-black/20 border-zinc-300 dark:border-gray-700 hover:bg-zinc-100/90 dark:bg-black/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${note.is_done ? 'line-through text-zinc-500 dark:text-gray-500' : 'text-zinc-800 dark:text-gray-200'}`}>
                    {note.content}
                  </p>
                  {note.reminder_at && (
                    <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatInTimeZone(new Date(note.reminder_at), SYSTEM_DEFAULT_TIMEZONE, 'd MMM yyyy, HH:mm')}
                      {' '}
                      <span className="text-zinc-500 dark:text-gray-600">PT</span>
                      {reminderDue(note) && !note.is_done && (
                        <span className="text-amber-400 flex items-center gap-1 ml-1">
                          <Bell className="w-3 h-3" />
                          Due
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleDone(note)}
                    className="p-1.5 rounded hover:bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 hover:text-green-400 transition-colors"
                    title={note.is_done ? 'Mark undone' : 'Mark done'}
                  >
                    <Check className={`w-4 h-4 ${note.is_done ? 'text-green-500' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(note.id)}
                    className="p-1.5 rounded hover:bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
