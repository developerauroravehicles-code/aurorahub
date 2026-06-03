'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Video, Copy, Check, Search, Users, X } from 'lucide-react'
import type { CommMeetRoom, CommUserProfile } from '@/lib/communication/types'
import { createMeetRoomAction } from '@/app/dashboard/communication/actions'

type Props = {
  initialRooms: CommMeetRoom[]
  profiles: CommUserProfile[]
}

export function MeetListContent({ initialRooms, profiles }: Props) {
  const router = useRouter()
  const [rooms, setRooms] = useState(initialRooms)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showInvitePicker, setShowInvitePicker] = useState(false)
  const [inviteSearch, setInviteSearch] = useState('')
  const [selectedInvites, setSelectedInvites] = useState<string[]>([])

  const filteredProfiles = profiles.filter((p) =>
    (p.full_name ?? '').toLowerCase().includes(inviteSearch.toLowerCase())
  )

  const toggleInvite = (id: string) => {
    setSelectedInvites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    const res = await createMeetRoomAction(title, selectedInvites)
    setCreating(false)
    if ('error' in res && res.error) {
      setError(res.error)
      return
    }
    if ('room' in res && res.room) {
      const room = res.room as CommMeetRoom
      setRooms((prev) => [room, ...prev.filter((r) => r.id !== room.id)])
      setTitle('')
      setSelectedInvites([])
      setShowInvitePicker(false)
      router.push(`/dashboard/communication/meet/${room.id}`)
      router.refresh()
    }
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/dashboard/communication/meet/join/${token}`
    void navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const active = rooms.filter((r) => r.status === 'active')
  const ended = rooms.filter((r) => r.status === 'ended')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Meet</h1>
        <p className="text-sm text-zinc-500">Only you and invited people can see your meets</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-gray-700 dark:bg-zinc-950">
        <h2 className="mb-3 font-semibold">Start instant meet</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="Meet title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-black"
          />
          <button
            type="button"
            onClick={() => setShowInvitePicker((v) => !v)}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-gray-600"
          >
            <Users className="h-4 w-4" />
            Invite {selectedInvites.length > 0 && `(${selectedInvites.length})`}
          </button>
          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreate()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Video className="h-4 w-4" />
            {creating ? 'Creating...' : 'Create Meet'}
          </button>
        </div>

        {showInvitePicker && (
          <div className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-gray-700">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Invite people</p>
              <button type="button" onClick={() => setShowInvitePicker(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search people..."
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                className="w-full rounded-md border border-zinc-300 py-2 pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-black"
              />
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {filteredProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleInvite(p.id)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-white/5 ${
                    selectedInvites.includes(p.id) ? 'bg-zinc-100 dark:bg-white/10' : ''
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium dark:bg-gray-700">
                    {(p.full_name ?? '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.full_name ?? 'Unknown'}</p>
                    {p.dealer && <p className="truncate text-xs text-zinc-500">{p.dealer.name}</p>}
                  </div>
                  {selectedInvites.includes(p.id) && <Users className="h-4 w-4 text-[#C27E00]" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Active</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((room) => (
              <MeetCard key={room.id} room={room} copiedToken={copiedToken} onCopy={copyLink} />
            ))}
          </div>
        </section>
      )}

      {ended.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Recent</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ended.slice(0, 12).map((room) => (
              <MeetCard key={room.id} room={room} copiedToken={copiedToken} onCopy={copyLink} ended />
            ))}
          </div>
        </section>
      )}

      {rooms.length === 0 && (
        <p className="text-center text-sm text-zinc-500 py-8">No meets yet. Create one to get started.</p>
      )}
    </div>
  )
}

function MeetCard({
  room,
  copiedToken,
  onCopy,
  ended,
}: {
  room: CommMeetRoom
  copiedToken: string | null
  onCopy: (token: string) => void
  ended?: boolean
}) {
  const host = room.host as { full_name?: string | null } | undefined

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-gray-700 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{room.title}</h3>
          <p className="text-xs text-zinc-500">
            Host: {host?.full_name ?? 'Unknown'} · {new Date(room.started_at).toLocaleString()}
          </p>
        </div>
        {!ended && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Live
          </span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        {!ended && (
          <Link
            href={`/dashboard/communication/meet/${room.id}`}
            className="flex-1 rounded-md bg-[#C27E00] py-2 text-center text-sm font-medium text-white"
          >
            Join
          </Link>
        )}
        <button
          type="button"
          onClick={() => onCopy(room.join_token)}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-gray-600"
        >
          {copiedToken === room.join_token ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          Link
        </button>
      </div>
    </div>
  )
}
