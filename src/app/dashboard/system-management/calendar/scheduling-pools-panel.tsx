'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Users, Building2, Pencil, X, Check, UserPlus } from 'lucide-react'

type SchedulingPoolRow = {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  dealer_count: number
  specialist_count: number
  specialists: { id: string; full_name: string }[]
  dealers: { id: string; name: string; scheduling_pool_id?: string | null }[]
}

type DealerRow = {
  id: string
  name: string
  scheduling_pool_id?: string | null
}

type SpecialistOption = {
  id: string
  full_name: string
}

interface SchedulingPoolsPanelProps {
  pools: SchedulingPoolRow[]
  dealers: DealerRow[]
  specialists: SpecialistOption[]
  createSchedulingPool: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  updateSchedulingPool: (
    poolId: string,
    code: string,
    name: string,
    description: string | null,
    isActive: boolean
  ) => Promise<{ success: boolean; error?: string }>
  deleteSchedulingPool: (poolId: string) => Promise<{ success: boolean; error?: string }>
  assignDealerToSchedulingPool: (
    dealerId: string,
    poolId: string | null
  ) => Promise<{ success: boolean; error?: string }>
  assignSpecialistToSchedulingPool: (
    poolId: string,
    specialistId: string
  ) => Promise<{ success: boolean; error?: string }>
  removeSpecialistFromSchedulingPool: (
    poolId: string,
    specialistId: string
  ) => Promise<{ success: boolean; error?: string }>
}

export function SchedulingPoolsPanel({
  pools,
  dealers,
  specialists,
  createSchedulingPool,
  updateSchedulingPool,
  deleteSchedulingPool,
  assignDealerToSchedulingPool,
  assignSpecialistToSchedulingPool,
  removeSpecialistFromSchedulingPool,
}: SchedulingPoolsPanelProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    code: '',
    name: '',
    description: '',
    isActive: true,
  })
  const [dealerFilter, setDealerFilter] = useState<string>('all')
  const [specialistPickByPool, setSpecialistPickByPool] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyPoolAction, setBusyPoolAction] = useState<string | null>(null)

  function startEdit(pool: SchedulingPoolRow) {
    setEditingPoolId(pool.id)
    setEditForm({
      code: pool.code,
      name: pool.name,
      description: pool.description ?? '',
      isActive: pool.is_active,
    })
    setShowForm(false)
    setMessage(null)
  }

  function cancelEdit() {
    setEditingPoolId(null)
    setEditForm({ code: '', name: '', description: '', isActive: true })
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const res = await createSchedulingPool(new FormData(e.currentTarget))
    setBusy(false)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else {
      setMessage({ type: 'success', text: 'Scheduling pool created.' })
      setShowForm(false)
      router.refresh()
    }
  }

  async function handleUpdate(pool: SchedulingPoolRow) {
    setBusy(true)
    setMessage(null)
    const res = await updateSchedulingPool(
      pool.id,
      editForm.code,
      editForm.name,
      editForm.description || null,
      editForm.isActive
    )
    setBusy(false)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else {
      setMessage({ type: 'success', text: 'Scheduling pool updated.' })
      cancelEdit()
      router.refresh()
    }
  }

  async function handleDealerPoolChange(dealerId: string, poolId: string) {
    setMessage(null)
    const res = await assignDealerToSchedulingPool(dealerId, poolId || null)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else {
      setMessage({ type: 'success', text: 'Dealer pool updated.' })
      router.refresh()
    }
  }

  async function handleDelete(poolId: string, code: string) {
    if (!confirm(`Delete scheduling pool "${code}"? Dealers will move to DEFAULT.`)) return
    setMessage(null)
    const res = await deleteSchedulingPool(poolId)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else {
      setMessage({ type: 'success', text: 'Pool deleted.' })
      if (editingPoolId === poolId) cancelEdit()
      router.refresh()
    }
  }

  async function handleAssignSpecialist(poolId: string) {
    const specialistId = specialistPickByPool[poolId]
    if (!specialistId) return

    setBusyPoolAction(`add-${poolId}`)
    setMessage(null)
    const res = await assignSpecialistToSchedulingPool(poolId, specialistId)
    setBusyPoolAction(null)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else {
      setMessage({ type: 'success', text: 'Specialist assigned to pool.' })
      setSpecialistPickByPool((prev) => ({ ...prev, [poolId]: '' }))
      router.refresh()
    }
  }

  async function handleRemoveSpecialist(poolId: string, specialistId: string, name: string) {
    if (!confirm(`Remove ${name} from this pool? They will be unlinked from all dealers in the pool.`)) return

    setBusyPoolAction(`remove-${poolId}-${specialistId}`)
    setMessage(null)
    const res = await removeSpecialistFromSchedulingPool(poolId, specialistId)
    setBusyPoolAction(null)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else {
      setMessage({ type: 'success', text: 'Specialist removed from pool.' })
      router.refresh()
    }
  }

  function renderPoolSpecialists(pool: SchedulingPoolRow) {
    const assignedIds = new Set(pool.specialists.map((s) => s.id))
    const availableSpecialists = specialists.filter((s) => !assignedIds.has(s.id))
    const isBusyAdd = busyPoolAction === `add-${pool.id}`

    return (
      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-gray-700">
        <div className="text-xs font-medium text-zinc-600 dark:text-gray-400 mb-2">Pool specialists</div>
        {pool.dealer_count === 0 ? (
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
            Assign dealers to this pool before adding specialists.
          </p>
        ) : (
          <>
            {pool.specialists.length > 0 ? (
              <ul className="flex flex-wrap gap-2 mb-2">
                {pool.specialists.map((specialist) => {
                  const removing = busyPoolAction === `remove-${pool.id}-${specialist.id}`
                  return (
                    <li
                      key={specialist.id}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-800 dark:text-gray-200"
                    >
                      <Users className="w-3 h-3 text-zinc-500" />
                      {specialist.full_name}
                      <button
                        type="button"
                        disabled={removing}
                        onClick={() =>
                          void handleRemoveSpecialist(pool.id, specialist.id, specialist.full_name)
                        }
                        className="p-0.5 text-red-400 hover:bg-red-500/10 rounded disabled:opacity-50"
                        title="Remove specialist from pool"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mb-2">
                No specialists yet — capacity defaults to 1 until you assign specialists.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={specialistPickByPool[pool.id] ?? ''}
                onChange={(e) =>
                  setSpecialistPickByPool((prev) => ({ ...prev, [pool.id]: e.target.value }))
                }
                disabled={availableSpecialists.length === 0 || isBusyAdd}
                className="rounded border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 px-2 py-1 text-xs min-w-[180px] disabled:opacity-50"
              >
                <option value="">
                  {availableSpecialists.length === 0 ? 'All specialists assigned' : 'Select specialist…'}
                </option>
                {availableSpecialists.map((specialist) => (
                  <option key={specialist.id} value={specialist.id}>
                    {specialist.full_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!specialistPickByPool[pool.id] || isBusyAdd}
                onClick={() => void handleAssignSpecialist(pool.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#C27E00] text-white text-xs disabled:opacity-50"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {isBusyAdd ? 'Adding…' : 'Add specialist'}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">
              Assigning a specialist links them to every dealer in this pool. Changes sync with Employees → Specialist
              dealer assignments.
            </p>
          </>
        )}
      </div>
    )
  }

  const filteredDealers =
    dealerFilter === 'all'
      ? dealers
      : dealerFilter === 'unassigned'
        ? dealers.filter((d) => !d.scheduling_pool_id)
        : dealers.filter((d) => d.scheduling_pool_id === dealerFilter)

  return (
    <div className="space-y-4 mb-10 pb-8 border-b border-zinc-300 dark:border-gray-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Scheduling Pools</h3>
          <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1 max-w-2xl">
            Nearby dealers share appointment capacity within a pool. Distant service areas use separate pools so
            the same time slot can be booked independently. Capacity equals the number of specialists assigned to
            dealers in that pool.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v)
            cancelEdit()
          }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
        >
          <Plus className="w-4 h-4" /> Add pool
        </button>
      </div>

      {message && (
        <div
          className={`px-3 py-2 rounded text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}
        >
          {message.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-3 p-4 rounded border border-zinc-300 dark:border-gray-700 bg-white/50 dark:bg-black/20">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Code</label>
            <input name="code" required placeholder="BC-INTERIOR" className="w-full rounded border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Name</label>
            <input name="name" required placeholder="BC Interior" className="w-full rounded border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Description</label>
            <input name="description" placeholder="Kelowna, Kamloops area" className="w-full rounded border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" disabled={busy} className="px-4 py-2 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
              {busy ? 'Saving…' : 'Create pool'}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {pools.map((pool) => {
          const isEditing = editingPoolId === pool.id
          const isDefault = pool.code === 'DEFAULT'

          return (
            <div
              key={pool.id}
              className={`rounded-lg border p-4 bg-white/40 dark:bg-white/5 ${
                isEditing
                  ? 'border-[#C27E00] dark:border-[#C27E00]'
                  : pool.is_active
                    ? 'border-zinc-300 dark:border-gray-700'
                    : 'border-zinc-300 dark:border-gray-700 opacity-75'
              }`}
            >
              {isEditing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">Edit pool</span>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-1.5 text-zinc-500 hover:bg-zinc-500/10 rounded"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Code</label>
                    <input
                      value={editForm.code}
                      onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                      disabled={isDefault}
                      required={!isDefault}
                      className="w-full rounded border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {isDefault && (
                      <p className="text-xs text-zinc-500 mt-1">Default pool code cannot be changed.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Name</label>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      className="w-full rounded border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2}
                      className="w-full rounded border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm resize-y"
                    />
                  </div>
                  {!isDefault && (
                    <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                        className="rounded border-zinc-300 dark:border-gray-600"
                      />
                      Active (inactive pools are hidden from new assignments)
                    </label>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busy || !editForm.name.trim()}
                      onClick={() => void handleUpdate(pool)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" /> {busy ? 'Saving…' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-3 py-1.5 rounded border border-zinc-300 dark:border-gray-600 text-sm text-zinc-700 dark:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                  {renderPoolSpecialists(pool)}
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-zinc-900 dark:text-white">{pool.name}</div>
                        {!pool.is_active && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-500/20 text-zinc-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">{pool.code}</div>
                      {pool.description && <p className="text-sm text-zinc-500 mt-1">{pool.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(pool)}
                        className="p-1.5 text-zinc-500 hover:text-[#C27E00] hover:bg-[#C27E00]/10 rounded"
                        title="Edit pool"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {!isDefault && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(pool.id, pool.code)}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"
                          title="Delete pool"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" /> {pool.dealer_count} dealer{pool.dealer_count !== 1 ? 's' : ''}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {pool.specialist_count} specialist capacity
                    </span>
                  </div>
                  {pool.dealers.length > 0 && (
                    <p className="text-xs text-zinc-500 mt-2">
                      <span className="font-medium text-zinc-600 dark:text-gray-400">Dealers: </span>
                      {pool.dealers.map((d) => d.name).join(', ')}
                    </p>
                  )}
                  {renderPoolSpecialists(pool)}
                </>
              )}
            </div>
          )
        })}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-white">Assign dealers to pools</h4>
          <select
            value={dealerFilter}
            onChange={(e) => setDealerFilter(e.target.value)}
            className="rounded border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 px-2 py-1 text-sm"
          >
            <option value="all">All dealers</option>
            <option value="unassigned">Unassigned only</option>
            {pools.map((pool) => (
              <option key={pool.id} value={pool.id}>
                {pool.name} ({pool.code})
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-zinc-200 dark:divide-gray-800">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-zinc-500">Dealer</th>
                <th className="px-3 py-2 text-left text-zinc-500">Scheduling pool</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
              {filteredDealers.map((dealer) => (
                <tr key={dealer.id}>
                  <td className="px-3 py-2 text-zinc-900 dark:text-white">{dealer.name}</td>
                  <td className="px-3 py-2">
                    <select
                      value={dealer.scheduling_pool_id ?? ''}
                      onChange={(e) => void handleDealerPoolChange(dealer.id, e.target.value)}
                      className="rounded border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 px-2 py-1 text-sm min-w-[200px]"
                    >
                      <option value="">— Unassigned —</option>
                      {pools.filter((p) => p.is_active).map((pool) => (
                        <option key={pool.id} value={pool.id}>
                          {pool.name} ({pool.code})
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {filteredDealers.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-4 text-center text-zinc-500">
                    No dealers match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
