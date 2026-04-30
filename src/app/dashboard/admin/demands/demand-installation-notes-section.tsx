'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { Trash2, Loader2 } from 'lucide-react'
import { addDemandInstallationNote, deleteDemandInstallationNote } from './installation-notes-actions'

export interface InstallationNoteRow {
  id: string
  body: string
  created_at: string
  author_id?: string
  profiles: { full_name: string | null } | null
}

interface DemandInstallationNotesSectionProps {
  demandId: string
  initialNotes: InstallationNoteRow[]
  timezoneName: string
}

const textareaClass =
  'mt-2 w-full min-h-[88px] rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] resize-y'

export function DemandInstallationNotesSection({
  demandId,
  initialNotes,
  timezoneName,
}: DemandInstallationNotesSectionProps) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    const trimmed = text.trim()
    if (!trimmed) {
      setMessage({ type: 'error', text: 'Enter a comment before saving.' })
      return
    }
    setAdding(true)
    const result = await addDemandInstallationNote(demandId, trimmed)
    setAdding(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setText('')
    setMessage({ type: 'success', text: 'Comment added.' })
    router.refresh()
  }

  async function handleDelete(noteId: string) {
    if (!confirm('Remove this installation comment?')) return
    setMessage(null)
    setRemovingId(noteId)
    const result = await deleteDemandInstallationNote(noteId, demandId)
    setRemovingId(null)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    router.refresh()
  }

  return (
    <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">After-installation notes</h2>
          <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">
            Aurora Manager only. Add separate entries (e.g. replaced dashcam, customer behaviour).
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="mb-8">
        <label htmlFor="installation-note-new" className="block text-sm font-medium text-zinc-600 dark:text-gray-300">
          Add a comment
        </label>
        <textarea
          id="installation-note-new"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='e.g. "Replaced front camera unit under warranty" or "Customer was difficult during handoff"'
          className={textareaClass}
          disabled={adding}
          maxLength={4000}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={adding || !text.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#C27E00] hover:bg-[#a06900] rounded-md disabled:opacity-50 disabled:pointer-events-none"
          >
            {adding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Add comment'
            )}
          </button>
          <span className="text-xs text-zinc-500 dark:text-gray-500">{4000 - text.length} characters left</span>
        </div>
      </form>

      {message && (
        <p className={`text-sm mb-4 ${message.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
          {message.text}
        </p>
      )}

      {initialNotes.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-gray-400">No installation notes yet.</p>
      ) : (
        <ul className="space-y-4">
          {initialNotes.map((note) => (
            <li
              key={note.id}
              className="border border-zinc-200 dark:border-gray-700 rounded-lg p-4 bg-white/60 dark:bg-black/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-900 dark:text-white whitespace-pre-wrap break-words">{note.body}</p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-gray-500">
                    {(note.profiles as { full_name?: string } | null)?.full_name ?? 'Unknown'} ·{' '}
                    {formatInTimeZone(new Date(note.created_at), timezoneName, 'PPP h:mm a')}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Delete comment"
                  onClick={() => handleDelete(note.id)}
                  disabled={removingId === note.id}
                  className="p-2 text-zinc-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 shrink-0 rounded-md hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
                >
                  {removingId === note.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
