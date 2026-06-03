'use client'

import { useState } from 'react'
import { Check, Copy, Search, Users, X } from 'lucide-react'
import type { CommUserProfile } from '@/lib/communication/types'
import { inviteMeetUsersAction } from '@/app/dashboard/communication/actions'

type Props = {
  roomId: string
  joinUrl: string
  profiles: CommUserProfile[]
  participantIds: string[]
  onClose: () => void
}

export function MeetInvitePanel({ roomId, joinUrl, profiles, participantIds, onClose }: Props) {
  const [tab, setTab] = useState<'link' | 'invite'>('invite')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const inCall = new Set(participantIds)
  const available = profiles.filter((p) => !inCall.has(p.id))
  const filtered = available.filter((p) =>
    (p.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const copyLink = () => {
    void navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const sendInvites = async () => {
    if (selected.length === 0) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    const res = await inviteMeetUsersAction(roomId, selected)
    setLoading(false)
    if ('error' in res && res.error) {
      setError(res.error)
      return
    }
    setSuccess(`${selected.length} invitation(s) sent`)
    setSelected([])
    setTimeout(() => setSuccess(null), 3000)
  }

  return (
    <div className="absolute bottom-full left-1/2 z-50 mb-3 w-[min(92vw,400px)] -translate-x-1/2 rounded-xl border border-zinc-700 bg-[#3c4043] p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-white">Add people</p>
        <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 flex gap-1 rounded-lg bg-[#202124] p-1">
        <button
          type="button"
          onClick={() => setTab('invite')}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
            tab === 'invite' ? 'bg-[#C27E00] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Invite colleagues
        </button>
        <button
          type="button"
          onClick={() => setTab('link')}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
            tab === 'link' ? 'bg-[#C27E00] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Share link
        </button>
      </div>

      {tab === 'link' ? (
        <>
          <p className="mb-3 text-xs text-zinc-400">
            Anyone with this link can join from the same office network or remotely.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={joinUrl}
              className="min-w-0 flex-1 truncate rounded-md border border-zinc-600 bg-[#202124] px-2 py-1.5 text-xs text-zinc-200"
            />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1 rounded-md bg-[#C27E00] px-3 py-1.5 text-xs font-medium text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-xs text-zinc-400">
            Invite users from your dealer or platform team. All roles can join and share screen.
          </p>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-zinc-600 bg-[#202124] py-2 pl-9 pr-3 text-xs text-white placeholder:text-zinc-500"
            />
          </div>
          <div className="max-h-44 space-y-1 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="py-4 text-center text-xs text-zinc-500">No colleagues available to invite</p>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleSelect(p.id)}
                className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-white/10 ${
                  selected.includes(p.id) ? 'bg-white/10 ring-1 ring-[#C27E00]' : ''
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5f6368] text-xs font-medium text-white">
                  {(p.full_name ?? '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white">{p.full_name ?? 'Unknown'}</p>
                  <p className="truncate text-[10px] text-zinc-400">
                    {p.role.replace(/_/g, ' ')}
                    {p.dealer ? ` · ${p.dealer.name}` : ' · Platform'}
                  </p>
                </div>
                {selected.includes(p.id) && <Users className="h-3.5 w-3.5 shrink-0 text-[#C27E00]" />}
              </button>
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          {success && <p className="mt-2 text-xs text-green-400">{success}</p>}
          {selected.length > 0 && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void sendInvites()}
              className="mt-3 w-full rounded-md bg-[#C27E00] py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Sending...' : `Send invite (${selected.length})`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
