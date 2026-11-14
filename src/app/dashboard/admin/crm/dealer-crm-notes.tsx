'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createDealerCrmNote, createNoteEmailReminder, cancelNoteReminder } from './actions'
import { FOLLOW_UP_OPTIONS } from '@/lib/crm/follow-up'
import { followUpKindLabel } from '@/lib/crm/follow-up'
import { formatInPT, SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
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
  dealerId,
  notes,
  emailSuggestions,
}: {
  dealerId: string
  notes: CrmNoteRow[]
  emailSuggestions: string[]
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [meetingAt, setMeetingAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [reminderNoteId, setReminderNoteId] = useState<string | null>(null)
  const [followUpKind, setFollowUpKind] = useState<string>('after_1d')
  const [meetingAtForReminder, setMeetingAtForReminder] = useState('')
  const [customRemindAt, setCustomRemindAt] = useState('')
  const [recipientEmail, setRecipientEmail] = useState(emailSuggestions[0] ?? '')

  async function submitNote(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const r = await createDealerCrmNote(dealerId, body, meetingAt || undefined)
    setPending(false)
    if (r.error) {
      setError(r.error)
      return
    }
    setBody('')
    setMeetingAt('')
    router.refresh()
  }

  async function submitReminder(e: React.FormEvent, noteId: string, noteMeetingAt: string | null) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const r = await createNoteEmailReminder({
      dealerId,
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
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Notes & meetings</h2>
      <p className="text-sm text-zinc-500 dark:text-gray-400">
        Enter the meeting time in Pacific (PT). Email follow-ups are scheduled relative to that time.
      </p>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={submitNote} className="space-y-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Meeting notes, outcomes, next steps…"
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
          <p className="mt-1 text-xs text-zinc-500">Optional but required for meeting-based follow-up emails.</p>
        </div>
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save note
        </button>
      </form>

      <ul className="space-y-4">
        {notes.map((note) => (
          <li
            key={note.id}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-white/5 p-4"
          >
            <p className="text-sm text-zinc-800 dark:text-gray-200 whitespace-pre-wrap">{note.body}</p>
            {note.meeting_at ? (
              <p className="mt-2 text-sm font-medium text-[#C27E00]">
                Meeting: {formatInPT(note.meeting_at, 'EEE MMM d, yyyy h:mm a')} PT
              </p>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">No meeting time set</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              {note.author?.full_name ?? 'Unknown'} · logged {formatInPT(note.created_at, 'MMM d, yyyy h:mm a')}
            </p>

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
                          await cancelNoteReminder(rem.id, dealerId)
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
            ) : (
              <button
                type="button"
                className="mt-2 text-sm text-[#C27E00] hover:underline"
                onClick={() => openReminderForm(note)}
              >
                Schedule follow-up email
              </button>
            )}
          </li>
        ))}
      </ul>

      <datalist id="crm-email-suggestions">
        {emailSuggestions.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
    </section>
  )
}