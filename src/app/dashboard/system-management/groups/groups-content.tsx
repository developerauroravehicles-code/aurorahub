'use client'

import { useState, useEffect } from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Pencil, Trash2, UserPlus, UserMinus, Search, Loader2 } from 'lucide-react'
import {
  createGroup,
  updateGroup,
  deleteGroup,
  addMemberToGroup,
  addMembersToGroup,
  removeMemberFromGroup,
  type getGroups,
  type getGroupMembers,
  type getProfilesForGroup,
} from './actions'

type GroupWithCount = Awaited<ReturnType<typeof getGroups>>[number]
type Member = Awaited<ReturnType<typeof getGroupMembers>>[number]
const ROLE_LABELS: Record<string, string> = {
  aurora_manager: 'Aurora Manager',
  it: 'IT',
  hr: 'HR',
  sales: 'Sales',
  finance: 'Finance',
  specialist: 'Technical Support',
  general_manager: 'General Manager',
}

export function GroupsContent({
  groups,
  initialMembers,
  allProfiles,
}: {
  groups: GroupWithCount[]
  initialMembers: Record<string, Member[]>
  allProfiles: Awaited<ReturnType<typeof getProfilesForGroup>>
}) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [addUserGroupId, setAddUserGroupId] = useState<string | null>(null)
  const [bulkAddGroupId, setBulkAddGroupId] = useState<string | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null)

  const [createState, createAction, createPending] = useActionState(
    async (_prev: { error?: string; success?: boolean }, fd: FormData) => {
      const r = await createGroup(fd)
      if ('error' in r) return { error: r.error }
      if ('success' in r) return { success: r.success }
      return r as { error: string }
    },
    { success: false }
  )

  useEffect(() => {
    if (createState?.success) {
      setCreating(false)
      router.refresh()
    }
  }, [createState?.success, router])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this group? Members will be removed.')) return
    setDeletingId(id)
    const r = await deleteGroup(id)
    setDeletingId(null)
    if (!(r && 'error' in r && r.error)) {
      setExpandedId(null)
      setEditingId(null)
      router.refresh()
    }
  }

  const handleAddMember = async (groupId: string, userId: string) => {
    setAddError(null)
    setAddingGroupId(groupId)
    const r = await addMemberToGroup(groupId, userId)
    setAddingGroupId(null)
    if (!(r && 'error' in r && r.error)) {
      setAddUserGroupId(null)
      router.refresh()
    } else {
      setAddError(r.error)
    }
  }

  const handleBulkAdd = async (groupId: string) => {
    if (selectedUserIds.size === 0) return
    setAddError(null)
    setAddingGroupId(groupId)
    const r = await addMembersToGroup(groupId, Array.from(selectedUserIds))
    setAddingGroupId(null)
    if (!(r && 'error' in r && r.error)) {
      setBulkAddGroupId(null)
      setSelectedUserIds(new Set())
      router.refresh()
    } else {
      setAddError(r.error)
    }
  }

  const toggleUserSelection = (userId: string, groupId: string) => {
    if (currentMembers(groupId).some((m) => m.user_id === userId)) return
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const handleRemoveMember = async (groupId: string, userId: string) => {
    const r = await removeMemberFromGroup(groupId, userId)
    if (!(r && 'error' in r && r.error)) router.refresh()
  }

  const currentMembers = (gid: string) => initialMembers[gid] ?? []
  const filteredGroups = searchQuery.trim()
    ? groups.filter(
        (g) =>
          g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (g.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      )
    : groups

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="search"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-700 bg-black/30 text-white text-sm placeholder-gray-500"
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white hover:bg-[#a66b00] shrink-0"
        >
          <Plus className="h-4 w-4" /> New Group
        </button>
      </div>

      {creating && (
        <form action={createAction} className="rounded-lg border border-gray-800 bg-white/5 p-4 space-y-3">
          <h4 className="font-medium text-white">New Group</h4>
          {createState?.error && <p className="text-sm text-red-400">{createState.error}</p>}
          <input name="name" placeholder="Group name" required className="w-full rounded border border-gray-700 bg-black/30 px-3 py-2 text-white" />
          <input name="description" placeholder="Description (optional)" className="w-full rounded border border-gray-700 bg-black/30 px-3 py-2 text-gray-300" />
          <div className="flex gap-2">
            <button type="submit" disabled={createPending} className="rounded bg-[#C27E00] px-4 py-2 text-sm text-white disabled:opacity-50">
              Create
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-300">
              Cancel
            </button>
          </div>
        </form>
      )}

      {addError && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {addError}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredGroups.map((g) => (
          <div key={g.id} className="rounded-lg border border-gray-800 bg-black/30 overflow-hidden">
            <div className="p-4">
              {editingId === g.id ? (
                <GroupEditForm
                  group={g}
                  onCancel={() => setEditingId(null)}
                  onSuccess={() => setEditingId(null)}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-[#C27E00]/20 p-2">
                        <Users className="h-5 w-5 text-[#C27E00]" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{g.name}</div>
                        <div className="text-xs text-gray-500">{g.member_count ?? 0} members</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditingId(g.id)} className="rounded p-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(g.id)}
                        disabled={deletingId === g.id}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                      >
                        {deletingId === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {g.description && <p className="mt-2 text-xs text-gray-500">{g.description}</p>}
                  <button
                    onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                    className="mt-3 text-xs text-[#C27E00] hover:underline"
                  >
                    {expandedId === g.id ? 'Hide members' : 'Show members'}
                  </button>
                </>
              )}
            </div>
            {expandedId === g.id && (
              <div className="border-t border-gray-800 p-4 bg-black/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">MEMBERS</span>
                  {addUserGroupId !== g.id && bulkAddGroupId !== g.id && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setAddUserGroupId(g.id); setBulkAddGroupId(null); setAddError(null) }}
                        className="inline-flex items-center gap-1 text-xs text-[#C27E00] hover:underline"
                      >
                        <UserPlus className="h-3 w-3" /> Add one
                      </button>
                      <span className="text-gray-600">|</span>
                      <button
                        onClick={() => { setBulkAddGroupId(g.id); setAddUserGroupId(null); setSelectedUserIds(new Set()); setAddError(null) }}
                        className="inline-flex items-center gap-1 text-xs text-[#C27E00] hover:underline"
                      >
                        Add multiple
                      </button>
                    </div>
                  )}
                </div>
                {bulkAddGroupId === g.id && (
                  <div className="space-y-2 p-2 rounded border border-gray-700 bg-black/30">
                    <p className="text-xs text-gray-400">Select users to add:</p>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {allProfiles
                        .filter((p) => !currentMembers(g.id).some((m) => m.user_id === p.id))
                        .slice(0, 25)
                        .map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/5 px-2 py-1 rounded">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.has(p.id)}
                              onChange={() => toggleUserSelection(p.id, g.id)}
                              className="rounded border-gray-600"
                            />
                            <span>{p.full_name || p.email || p.id.slice(0, 8)} {(p as { dealer_code?: string | null }).dealer_code ? `(${(p as { dealer_code?: string | null }).dealer_code})` : ''}</span>
                          </label>
                        ))}
                    </div>
                    {allProfiles.filter((p) => !currentMembers(g.id).some((m) => m.user_id === p.id)).length > 25 && (
                      <p className="text-gray-500 text-xs">Showing first 25. Use &quot;Add one&quot; for the rest.</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleBulkAdd(g.id)}
                        disabled={selectedUserIds.size === 0 || addingGroupId === g.id}
                        className="text-xs bg-[#C27E00] text-white px-2 py-1 rounded disabled:opacity-50 flex items-center gap-1"
                      >
                        {addingGroupId === g.id && <Loader2 className="h-3 w-3 animate-spin" />}
                        Add {selectedUserIds.size} selected
                      </button>
                      <button
                        onClick={() => { setBulkAddGroupId(null); setSelectedUserIds(new Set()); setAddError(null) }}
                        className="text-xs text-gray-500 hover:text-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {addUserGroupId === g.id && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        className="text-xs rounded border border-gray-700 bg-black/50 text-white py-1 min-w-[140px]"
                        onChange={(e) => {
                          const uid = e.target.value
                          if (uid) handleAddMember(g.id, uid)
                          e.target.value = ''
                        }}
                        disabled={addingGroupId === g.id}
                      >
                        <option value="">Select user...</option>
                        {allProfiles
                          .filter((p) => !currentMembers(g.id).some((m) => m.user_id === p.id))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.full_name || p.email || p.id.slice(0, 8)} {(p as { dealer_code?: string | null }).dealer_code ? `(${(p as { dealer_code?: string | null }).dealer_code})` : ''}
                            </option>
                          ))}
                      </select>
                      {addingGroupId === g.id && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                      <button
                        onClick={() => { setAddUserGroupId(null); setAddError(null) }}
                        className="text-xs text-gray-500 hover:text-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                )}
                <ul className="space-y-1">
                  {currentMembers(g.id).length === 0 ? (
                    <li className="text-xs text-gray-500">No members yet</li>
                  ) : (
                    currentMembers(g.id).map((m) => (
                      <li key={m.user_id} className="flex items-center justify-between text-sm text-gray-300 py-1">
                        <div>
                          <span className="font-medium">{m.profile?.full_name ?? (m.profile as { email?: string })?.email ?? m.user_id.slice(0, 8)}</span>
                          {(m.profile as { dealer_code?: string | null })?.dealer_code && (
                            <span className="ml-2 text-xs text-gray-500">({(m.profile as { dealer_code?: string | null }).dealer_code})</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveMember(g.id, m.user_id)}
                          className="text-gray-500 hover:text-red-400 p-1"
                          title="Remove member"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredGroups.length === 0 && (
        <p className="text-sm text-gray-500 py-6">
          {groups.length === 0 && !creating
            ? 'No groups created yet. Click "New Group" to create one.'
            : `No groups match "${searchQuery}".`}
        </p>
      )}
    </div>
  )
}

function GroupEditForm({
  group,
  onCancel,
  onSuccess,
}: {
  group: GroupWithCount
  onCancel: () => void
  onSuccess: () => void
}) {
  const [state, formAction, isPending] = useActionState(
    async (_: unknown, fd: FormData) => {
      const r = await updateGroup(group.id, fd)
      if (!(r && 'error' in r && r.error)) onSuccess()
      return r
    },
    {} as { error?: string }
  )
  return (
    <form action={formAction} className="space-y-3">
      {'error' in (state ?? {}) && (state as { error?: string }).error ? <p className="text-sm text-red-400">{(state as { error: string }).error}</p> : null}
      <input name="name" defaultValue={group.name} required className="w-full rounded border border-gray-700 bg-black/30 px-3 py-2 text-white text-sm" />
      <input name="description" defaultValue={group.description ?? ''} className="w-full rounded border border-gray-700 bg-black/30 px-3 py-2 text-gray-300 text-sm" />
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="rounded bg-[#C27E00] px-3 py-1.5 text-xs text-white">
          Save
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-600 px-3 py-1.5 text-xs text-gray-300">
          Cancel
        </button>
      </div>
    </form>
  )
}
