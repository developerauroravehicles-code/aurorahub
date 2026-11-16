'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCrmNote,
  createNoteEmailReminder,
  cancelNoteReminder,
  updateCrmMainSummary,
  updateCrmNote,
  deleteCrmNote,
  type CrmNoteOwner,
} from './actions'
import { FOLLOW_UP_OPTIONS } from '@/lib/crm/follow-up'
import { followUpKindLabel } from '@/lib/crm/follow-up'
import { formatInPT, SYSTEM_DEFAULT_TIMEZONE, ptIsoToDatetimeLocalValue } from '@/lib/timezone-defaults'
import { formatInTimeZone } from 'date-fns-tz'

export type CrmNoteRow = {
  id: string
  body: string
  meeting_at: string | null
  created_at: string
  author?: { full_name: string | null } | null
  reminders: {
    id: string
    remind_on: string
    remind_at: string | null
    follow_up_kind: string | null
    recipient_email: string
    subject: string
    status: string
    sent_at: string | null
    last_error: string | null
  }[]
}

export function DealerCrmNotes({
  owner,
  mainSummary,
  notes,
  emailSuggestions,
}: {
  owner: CrmNoteOwner
  mainSummary: string | null
  notes: CrmNoteRow[]
  emailSuggestions: string[]
}) {
  const router = useRouter()
  const [summary, setSummary] = useState(mainSummary ?? '')
  const [summaryPending, setSummaryPending] = useState(false)

  useEffect(() => {
    setSummary(mainSummary ?? '')
  }, [mainSummary])

  const [body, setBody] = useState('')
  const [meetingAt, setMeetingAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [reminderNoteId, setReminderNoteId] = useState<string | null>(null)
  const [followUpKind, setFollowUpKind] = useState<string>('after_1d')
  const [meetingAtForReminder, setMeetingAtForReminder] = useState('')
  const [customRemindAt, setCustomRemindAt] = useState('')
  const [recipientEmail, setRecipientEmail] = useState(emailSuggestions[0] ?? '')

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editMeetingAt, setEditMeetingAt] = useState('')

  async function submitSummary(e: React.FormEvent) {
    e.preventDefault()
    setSummaryPending(true)
    setError(null)
    const r = await updateCrmMainSummary(owner, summary)
    setSummaryPending(false)
    if (r.error) {
      setError(r.error)
      return
    }
    router.refresh()
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const r = await createCrmNote(owner, body, meetingAt || undefined)
    setPending(false)
    if (r.error) {
      setError(r.error)
      return
    }
    setBody('')
    setMeetingAt('')
    router.refresh()
  }

  function startEdit(note: CrmNoteRow) {
    setEditingNoteId(note.id)
    setEditBody(note.body)
    setEditMeetingAt(note.meeting_at ? ptIsoToDatetimeLocalValue(note.meeting_at) : '')
    setError(null)
  }

  async function saveEdit(noteId: string) {
    setPending(true)
    setError(null)
    const r = await updateCrmNote(owner, noteId, {
      body: editBody,
      meetingAtLocal: editMeetingAt,
    })
    setPending(false)
    if (r.error) {
      setError(r.error)
      return
    }
    setEditingNoteId(null)
    router.refresh()
  }

  async function removeNote(noteId: string) {
    if (!window.confirm('Delete this comment? Pending follow-up emails on it will be cancelled.')) return
    setPending(true)
    setError(null)
    const r = await deleteCrmNote(owner, noteId)
    setPending(false)
    if (r.error) {
      setError(r.error)
      return
    }
    if (reminderNoteId === noteId) setReminderNoteId(null)
    if (editingNoteId === noteId) setEditingNoteId(null)
    router.refresh()
  }

  async function submitReminder(e: React.FormEvent, noteId: string, noteMeetingAt: string | null) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const r = await createNoteEmailReminder({
      owner,
      noteId,
      recipientEmail,
      followUpKind: followUpKind as Parameters<typeof createNoteEmailReminder>[0]['followUpKind'],
      meetingAtLocal: noteMeetingAt ? undefined : meetingAtForReminder || undefined,
      customRemindAtLocal: followUpKind === 'custom' ? customRemindAt : undefined,
    })
    setPending(false)
    if (r.error) {
      setError(r.error)
      return
    }
    setReminderNoteId(null)
    router.refresh()
  }

  function openReminderForm(note: CrmNoteRow) {
    setReminderNoteId(note.id)
    setFollowUpKind(note.meeting_at ? 'after_1d' : 'custom')
    setMeetingAtForReminder('')
    setCustomRemindAt('')
    setError(null)
  }

  return (
    <section className="space-y-6">
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={submitSummary} className="space-y-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Main conversation</h2>
        <p className="text-sm text-zinc-500 dark:text-gray-400">
          Primary context for this account — like the headline story (e.g. Nissan deal overview). Comments and meeting
          follow-ups go below.
        </p>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={6}
          placeholder="Who we spoke with, deal status, key agreements, open items…"
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={summaryPending}
          className="rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save main text
        </button>
      </form>

      <div className="space-y-4">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Comments & meetings</h3>
        <p className="text-sm text-zinc-500 dark:text-gray-400">
          Meeting times use Pacific (PT). Follow-up emails are scheduled from each comment&apos;s meeting time.
        </p>

        <form
          onSubmit={submitNote}
          className="space-y-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-4"
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Add a comment (call recap, next step, internal note)…"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-gray-300 mb-1">
              Meeting date & time (PT)
            </label>
            <input
              type="datetime-local"
              value={meetingAt}
              onChange={(e) => setMeetingAt(e.target.value)}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="rounded-md border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            Add comment
          </button>
        </form>

        <ul className="space-y-4">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Comment</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  {editingNoteId === note.id ? (
                    <>
                      <button
                        type="button"
                        className="text-[#C27E00] hover:underline disabled:opacity-50"
                        disabled={pending}
                        onClick={() => saveEdit(note.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="text-zinc-500 hover:underline"
                        onClick={() => setEditingNoteId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="text-zinc-600 hover:underline" onClick={() => startEdit(note)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        disabled={pending}
                        onClick={() => removeNote(note.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editingNoteId === note.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  />
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Meeting (PT)</label>
                    <input
                      type="datetime-local"
                      value={editMeetingAt}
                      onChange={(e) => setEditMeetingAt(e.target.value)}
                      className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-800 dark:text-gray-200 whitespace-pre-wrap">{note.body}</p>
              )}

              {editingNoteId !== note.id ? (
                <>
                  {note.meeting_at ? (
                    <p className="mt-2 text-sm font-medium text-[#C27E00]">
                      Meeting: {formatInPT(note.meeting_at, 'EEE MMM d, yyyy h:mm a')} PT
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">No meeting time set</p>
                  )}
                  <p className="mt-1 text-xs text-zinc-500">
                    {note.author?.full_name ?? 'Unknown'} · {formatInPT(note.created_at, 'MMM d, yyyy h:mm a')}
                  </p>
                </>
              ) : null}

              {note.reminders.length > 0 ? (
                <ul className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-gray-400">
                  {note.reminders.map((rem) => (
                    <li key={rem.id} className="flex flex-wrap items-center gap-2">
                      <span>
                        Follow-up{' '}
                        {rem.remind_at
                          ? formatInTimeZone(new Date(rem.remind_at), SYSTEM_DEFAULT_TIMEZONE, 'MMM d, h:mm a')
                          : rem.remind_on}{' '}
                        PT · {followUpKindLabel(rem.follow_up_kind)} → {rem.recipient_email} ({rem.status})
                      </span>
                      {rem.status === 'pending' ? (
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={async () => {
                            await cancelNoteReminder(rem.id, owner)
                            router.refresh()
                          }}
                        >
                          Cancel
                        </button>
                      ) : null}
                      {rem.last_error ? <span className="text-red-500">{rem.last_error}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {reminderNoteId === note.id ? (
                <form
                  onSubmit={(e) => submitReminder(e, note.id, note.meeting_at)}
                  className="mt-3 space-y-3 rounded border border-zinc-200 dark:border-zinc-700 p-3"
                >
                  <p className="text-sm font-medium text-zinc-800 dark:text-gray-200">Schedule follow-up email</p>
                  {!note.meeting_at ? (
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Meeting time (PT) — required for offsets</label>
                      <input
                        type="datetime-local"
                        required
                        value={meetingAtForReminder}
                        onChange={(e) => setMeetingAtForReminder(e.target.value)}
                        className="block rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm"
                      />
                    </div>
                  ) : null}
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">When to send</label>
                    <select
                      value={followUpKind}
                      onChange={(e) => setFollowUpKind(e.target.value)}
                      className="block w-full max-w-md rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm"
                    >
                      {FOLLOW_UP_OPTIONS.map((o) => (
                        <option key={o.kind} value={o.kind}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {followUpKind === 'custom' ? (
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Custom send time (PT)</label>
                      <input
                        type="datetime-local"
                        required
                        value={customRemindAt}
                        onChange={(e) => setCustomRemindAt(e.target.value)}
                        className="block rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm"
                      />
                    </div>
                  ) : null}
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Email to</label>
                    <input
                      type="email"
                      required
                      list="crm-email-suggestions"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="block rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm min-w-[200px]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded bg-zinc-800 dark:bg-zinc-700 text-white px-3 py-1.5 text-sm"
                    >
                      Schedule follow-up
                    </button>
                    <button type="button" className="text-sm text-zinc-500" onClick={() => setReminderNoteId(null)}>
                      Close
                    </button>
                  </div>
                </form>
              ) : editingNoteId !== note.id ? (
                <button
                  type="button"
                  className="mt-2 text-sm text-[#C27E00] hover:underline"
                  onClick={() => openReminderForm(note)}
                >
                  Schedule follow-up email
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <datalist id="crm-email-suggestions">
        {emailSuggestions.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
    </section>
  )
}