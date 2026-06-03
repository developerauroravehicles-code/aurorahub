'use client'

import { useState } from 'react'
import { X, Search, Users } from 'lucide-react'
import type { CommUserProfile } from '@/lib/communication/types'
import { createDirectConversationAction, createGroupConversationAction } from '@/app/dashboard/communication/actions'

type Props = {
  profiles: CommUserProfile[]
  onClose: () => void
  onCreated: (conversationId: string) => void
}

export function NewChatDialog({ profiles, onClose, onCreated }: Props) {
  const [mode, setMode] = useState<'direct' | 'group'>('direct')
  const [search, setSearch] = useState('')
  const [groupTitle, setGroupTitle] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = profiles.filter((p) =>
    (p.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleDirect = async (userId: string) => {
    setLoading(true)
    setError(null)
    const res = await createDirectConversationAction(userId)
    setLoading(false)
    if ('error' in res && res.error) {
      setError(res.error)
      return
    }
    if ('conversationId' in res && res.conversationId) {
      onCreated(res.conversationId)
      onClose()
    }
  }

  const handleGroup = async () => {
    setLoading(true)
    setError(null)
    const res = await createGroupConversationAction(groupTitle, selected)
    setLoading(false)
    if ('error' in res && res.error) {
      setError(res.error)
      return
    }
    if ('conversationId' in res && res.conversationId) {
      onCreated(res.conversationId)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-gray-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-gray-700">
          <h2 className="text-lg font-semibold">New conversation</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-zinc-200 px-4 py-2 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setMode('direct')}
            className={`rounded px-3 py-1 text-sm ${mode === 'direct' ? 'bg-[#C27E00] text-white' : 'text-zinc-600 dark:text-gray-400'}`}
          >
            Direct
          </button>
          <button
            type="button"
            onClick={() => setMode('group')}
            className={`rounded px-3 py-1 text-sm ${mode === 'group' ? 'bg-[#C27E00] text-white' : 'text-zinc-600 dark:text-gray-400'}`}
          >
            Group
          </button>
        </div>

        <div className="p-4 space-y-3">
          {mode === 'group' && (
            <input
              type="text"
              placeholder="Group name"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-black"
            />
          )}

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-zinc-300 py-2 pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-black"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={loading}
                onClick={() => (mode === 'direct' ? handleDirect(p.id) : toggleSelect(p.id))}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-white/5 ${
                  mode === 'group' && selected.includes(p.id) ? 'bg-zinc-100 dark:bg-white/10' : ''
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium dark:bg-gray-700">
                  {(p.full_name ?? '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.full_name ?? 'Unknown'}</p>
                  {p.dealer && (
                    <p className="truncate text-xs text-zinc-500">{p.dealer.name}</p>
                  )}
                </div>
                {mode === 'group' && selected.includes(p.id) && (
                  <Users className="h-4 w-4 text-[#C27E00]" />
                )}
              </button>
            ))}
          </div>

          {mode === 'group' && selected.length > 0 && (
            <button
              type="button"
              disabled={loading || !groupTitle.trim()}
              onClick={handleGroup}
              className="w-full rounded-md bg-[#C27E00] py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Create group ({selected.length} members)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
