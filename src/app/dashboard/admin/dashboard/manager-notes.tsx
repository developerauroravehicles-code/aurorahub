'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
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
      <div className="bg-white/5 border border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Notes & Reminders</h2>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Notes & Reminders</h2>
      </div>

      <form onSubmit={handleAdd} className="mb-4 flex flex-col gap-2">
        <input
          type="text"
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="Add a note..."
          className="w-full px-3 py-2 bg-black/30 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
          disabled={submitting}
        />
        <div className="flex gap-2 items-center">
          <input
            type="datetime-local"
            value={newReminderAt}
            onChange={e => setNewReminderAt(e.target.value)}
            className="flex-1 px-3 py-2 bg-black/30 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-[#C27E00]"
          />
          <button
            type="submit"
            disabled={!newContent.trim() || submitting}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#C27E00] hover:bg-[#a06900] text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : notes.length === 0 ? (
        <p className="text-gray-500 text-sm">No notes yet. Add one above.</p>
      ) : (
        <ul className="space-y-2 max-h-[280px] overflow-y-auto">
          {notes.map(note => (
            <li
              key={note.id}
              className={`p-3 rounded-lg border transition-colors ${
                note.is_done
                  ? 'bg-black/20 border-gray-800 opacity-75'
                  : reminderDue(note)
                    ? 'bg-amber-900/30 border-amber-700'
                    : 'bg-black/20 border-gray-700 hover:bg-black/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${note.is_done ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                    {note.content}
                  </p>
                  {note.reminder_at && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(note.reminder_at), 'd MMM yyyy, HH:mm')}
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
                    className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-green-400 transition-colors"
                    title={note.is_done ? 'Mark undone' : 'Mark done'}
                  >
                    <Check className={`w-4 h-4 ${note.is_done ? 'text-green-500' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(note.id)}
                    className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
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
