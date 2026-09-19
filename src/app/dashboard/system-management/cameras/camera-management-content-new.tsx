'use client'

import { useState, useEffect, useTransition, memo, useCallback } from 'react'
import {
  createCameraModel,
  deleteCameraModel,
  toggleCameraModelStatus,
  updateCameraModel,
  assignCameraToDealer,
  assignCameraToAllDealers,
  removeCameraFromDealer,
  updateDealerCameraSortOrder,
} from '../actions'
import { useActionState } from 'react'
import { Trash2, Power, PowerOff, Edit2, Building2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { CameraModel, Dealer, SystemDataErrors } from '@/types/system-management'

export const CameraManagementContent = memo(function CameraManagementContent({ cameras, dealers, errors }: { cameras: CameraModel[], dealers: Dealer[], errors: SystemDataErrors }) {
  const [state, formAction, isPending] = useActionState(createCameraModel, null)
  const [editState, editFormAction, isEditPending] = useActionState(updateCameraModel, null)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isToggling, startToggleTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dealerAssigningId, setDealerAssigningId] = useState<string | null>(null)
  const [assigningDealerId, setAssigningDealerId] = useState<string | null>(null)
  const [removingDealerId, setRemovingDealerId] = useState<string | null>(null)
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [camerasState, setCamerasState] = useState(cameras)
  const router = useRouter()

  useEffect(() => {
    setCamerasState(cameras)
  }, [cameras])

  const patchCameraDealerLinks = useCallback(
    (cameraId: string, patch: (links: NonNullable<CameraModel['dealer_cameras']>) => NonNullable<CameraModel['dealer_cameras']>) => {
      setCamerasState((prev) =>
        prev.map((c) => {
          if (c.id !== cameraId) return c
          const links = c.dealer_cameras ?? []
          return { ...c, dealer_cameras: patch([...links]) }
        })
      )
    },
    []
  )

  useEffect(() => {
    if (editState?.success) {
      setEditingId(null)
      router.refresh()
    }
  }, [editState, router])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this camera model?')) return

    startDeleteTransition(async () => {
      try {
        const result = await deleteCameraModel(id)
        if (result?.success) {
          router.refresh()
        } else {
          alert(result?.error || 'Failed to delete camera model')
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete camera model')
      }
    })
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    startToggleTransition(async () => {
      try {
        const result = await toggleCameraModelStatus(id, !currentStatus)
        if (result?.success) {
          router.refresh()
        } else {
          alert(result?.error || 'Failed to update camera model status')
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to update camera model status')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Camera Models Management</h3>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">Add and manage camera models for the system</p>
      </div>

      {/* Create Camera Form */}
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
        <h4 className="text-md font-semibold text-zinc-900 dark:text-white mb-4">Add New Camera Model</h4>
        
        {state?.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100 mb-4">
            {state.error}
          </div>
        )}
        
        {state?.success && (
          <div className="bg-green-50 text-green-600 p-3 rounded-md text-sm border border-green-100 mb-4">
            {state.success}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-2">
              Camera Model Name *
            </label>
            <input
              type="text"
              name="name"
              required
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="e.g., Aurora Pro 4K"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              name="description"
              rows={3}
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="Camera model description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-2">
              Stock photo URL (customer portal)
            </label>
            <input
              type="url"
              name="imageUrl"
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-2">
              User manual URL (PDF)
            </label>
            <input
              type="url"
              name="userManualUrl"
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-2">
              Troubleshooting JSON (optional)
            </label>
            <textarea
              name="troubleshootingJson"
              rows={3}
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs"
              placeholder='[{"title":"No recording","body":"Check SD card..."}]'
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" name="bookingDisplayAsSet" className="rounded border-zinc-300" />
            Show as <strong>Set</strong> on dealer booking forms
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? 'Creating...' : 'Create Camera Model'}
          </button>
        </form>
      </div>

      {/* Camera Models List */}
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
        <h4 className="text-md font-semibold text-zinc-900 dark:text-white mb-4">
          Camera Models ({cameras.length})
        </h4>
        {errors.cameras && <p className="text-red-500 text-sm mb-2">{errors.cameras}</p>}
        
        {cameras.length === 0 ? (
          <p className="text-zinc-500 dark:text-gray-400 text-center py-8">No camera models found. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {camerasState.map((camera) => (
              <div
                key={camera.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  camera.is_active 
                    ? 'bg-zinc-200/50 dark:bg-white/5 border-zinc-200 dark:border-gray-800' 
                    : 'bg-white/2 border-gray-900 opacity-60'
                }`}
              >
                <div className="flex-1">
                  {editingId === camera.id ? (
                    <form action={editFormAction} className="space-y-3">
                      <input type="hidden" name="id" value={camera.id} />
                      <input
                        type="text"
                        name="name"
                        defaultValue={camera.name}
                        required
                        className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-white/10 px-3 py-2 text-zinc-900 dark:text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
                      />
                      <textarea
                        name="description"
                        defaultValue={camera.description || ''}
                        rows={2}
                        className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-white/10 px-3 py-2 text-zinc-900 dark:text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
                      />
                      <input
                        type="url"
                        name="imageUrl"
                        defaultValue={camera.image_url || ''}
                        placeholder="Portal stock photo URL"
                        className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-white/10 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm"
                      />
                      <input
                        type="url"
                        name="userManualUrl"
                        defaultValue={camera.user_manual_url || ''}
                        placeholder="User manual PDF URL"
                        className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-white/10 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm"
                      />
                      <textarea
                        name="troubleshootingJson"
                        rows={3}
                        defaultValue={
                          camera.troubleshooting_json
                            ? JSON.stringify(camera.troubleshooting_json, null, 2)
                            : ''
                        }
                        placeholder='[{"title":"Issue","body":"Fix..."}]'
                        className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-white/10 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs"
                      />
                      <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          name="bookingDisplayAsSet"
                          defaultChecked={Boolean(camera.booking_display_as_set)}
                          className="rounded border-zinc-300"
                        />
                        Show as Set on dealer booking forms
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={isEditPending}
                          className="bg-[#C27E00] hover:bg-[#a06900] text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                      {editState?.error && (
                        <p className="text-red-400 text-xs">{editState.error}</p>
                      )}
                      {editState?.success && (
                        <p className="text-green-400 text-xs">{editState.success}</p>
                      )}
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h5 className="text-zinc-900 dark:text-white font-medium">{camera.name}</h5>
                        {camera.booking_display_as_set && (
                          <span className="px-2 py-0.5 text-xs rounded bg-purple-900/40 text-purple-200 border border-purple-700/50">
                            Set
                          </span>
                        )}
                        {!camera.is_active && (
                          <span className="px-2 py-1 text-xs rounded bg-gray-800 text-zinc-500 dark:text-gray-400">
                            Inactive
                          </span>
                        )}
                      </div>
                      {camera.description && (
                        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">{camera.description}</p>
                      )}
                      {camera.dealer_cameras && camera.dealer_cameras.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-zinc-500 dark:text-gray-500 mb-1">Assigned to {camera.dealer_cameras.length} dealer{camera.dealer_cameras.length !== 1 ? 's' : ''}:</p>
                          <div className="flex flex-wrap gap-1">
                            {camera.dealer_cameras?.slice(0, 3).map((dc) => (
                              <span
                                key={dc.dealer_id}
                                className="text-xs px-2 py-0.5 bg-[#C27E00]/20 text-[#C27E00] rounded border border-[#C27E00]/30"
                              >
                                {dc.dealers?.name || 'Unknown'}
                              </span>
                            ))}
                            {camera.dealer_cameras.length > 3 && (
                              <span className="text-xs px-2 py-0.5 text-zinc-500 dark:text-gray-400">
                                +{camera.dealer_cameras.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {editingId !== camera.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingId(camera.id)
                        setDealerAssigningId(null)
                      }}
                      className="p-2 rounded text-blue-500 hover:bg-blue-900/20 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDealerAssigningId(camera.id)
                        setEditingId(null)
                      }}
                      className="p-2 rounded text-purple-500 hover:bg-purple-900/20 transition-colors"
                      title="Assign to Dealer"
                    >
                      <Building2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(camera.id, camera.is_active)}
                      disabled={isToggling}
                      className={`p-2 rounded transition-colors ${
                        camera.is_active
                          ? 'text-yellow-500 hover:bg-yellow-900/20'
                          : 'text-green-500 hover:bg-green-900/20'
                      } disabled:opacity-50`}
                      title={camera.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {camera.is_active ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(camera.id)}
                      disabled={isDeleting}
                      className="p-2 rounded text-red-500 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dealer Assignment Modal */}
      {dealerAssigningId && (
        <div 
          className="fixed inset-0 bg-white dark:bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dealer-assignment-title"
          aria-describedby="dealer-assignment-description"
        >
          <div className="bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 id="dealer-assignment-title" className="text-zinc-900 dark:text-white font-semibold text-lg">Assign to Dealers</h3>
                <p id="dealer-assignment-description" className="text-sm text-zinc-500 dark:text-gray-400 mt-1">
                  Assign dealers and set booking order (lower number appears first on demand forms).
                </p>
              </div>
              <button
                onClick={() => setDealerAssigningId(null)}
                className="text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {(() => {
                const cam = camerasState.find((c) => c.id === dealerAssigningId)
                const assigned = [...(cam?.dealer_cameras ?? [])].sort(
                  (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
                )
                if (assigned.length === 0) return null
                return (
                  <div className="rounded-lg border border-[#C27E00]/30 bg-[#C27E00]/5 p-4 space-y-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      Assigned dealers — booking order
                    </p>
                    <p className="text-xs text-zinc-500">
                      Order applies per dealer on Create Demand (Sales / Finance).
                    </p>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {assigned.map((dc) => (
                        <AssignedDealerSortRow
                          key={dc.dealer_id}
                          dealerName={dc.dealers?.name ?? 'Dealer'}
                          dealerCode={(dc.dealers as { code?: string } | undefined)?.code}
                          sortOrder={dc.sort_order ?? 0}
                          onSave={async (sortOrder) => {
                            if (!dealerAssigningId) return
                            const result = await updateDealerCameraSortOrder(
                              dealerAssigningId,
                              dc.dealer_id,
                              sortOrder
                            )
                            if (result.error) alert(result.error)
                            else {
                              patchCameraDealerLinks(dealerAssigningId, (links) =>
                                links.map((l) =>
                                  l.dealer_id === dc.dealer_id ? { ...l, sort_order: sortOrder } : l
                                )
                              )
                            }
                          }}
                        />
                      ))}
                    </ul>
                  </div>
                )
              })()}
              <p className="text-xs text-zinc-500 dark:text-gray-400">
                Only assigned cameras appear on that dealer&apos;s booking form. Use bulk assign to add all dealers at once.
              </p>
              <button
                type="button"
                disabled={bulkAssigning || !dealerAssigningId}
                onClick={async () => {
                  if (!dealerAssigningId) return
                  if (!confirm('Assign this camera model to all dealers? Existing links are kept; only missing dealers are added.')) return
                  setBulkAssigning(true)
                  try {
                    const result = await assignCameraToAllDealers(dealerAssigningId)
                    if (result?.error) {
                      alert(result.error)
                    } else if (result?.success && dealerAssigningId) {
                      const cam = camerasState.find((c) => c.id === dealerAssigningId)
                      const linked = new Set((cam?.dealer_cameras ?? []).map((d) => d.dealer_id))
                      let nextSort =
                        Math.max(0, ...(cam?.dealer_cameras ?? []).map((d) => d.sort_order ?? 0)) + 10
                      patchCameraDealerLinks(dealerAssigningId, (links) => {
                        const out = [...links]
                        for (const d of dealers) {
                          if (linked.has(d.id)) continue
                          out.push({
                            dealer_id: d.id,
                            camera_model_id: dealerAssigningId,
                            sort_order: nextSort,
                            dealers: d,
                          })
                          nextSort += 10
                        }
                        return out
                      })
                    }
                  } finally {
                    setBulkAssigning(false)
                  }
                }}
                className="w-full rounded-md border border-[#C27E00]/50 bg-[#C27E00]/15 px-3 py-2 text-sm font-medium text-[#C27E00] hover:bg-[#C27E00]/25 disabled:opacity-50"
              >
                {bulkAssigning ? 'Assigning…' : 'Assign to all dealers'}
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {dealers.map((dealer) => (
                  <DealerAssignmentItem
                    key={dealer.id}
                    dealer={dealer}
                    cameraId={dealerAssigningId}
                    initialSortOrder={
                      camerasState
                        .find((c) => c.id === dealerAssigningId)
                        ?.dealer_cameras?.find((dc) => dc.dealer_id === dealer.id)?.sort_order ?? 0
                    }
                    onSortSave={async (sortOrder) => {
                      if (!dealerAssigningId) return
                      const result = await updateDealerCameraSortOrder(
                        dealerAssigningId,
                        dealer.id,
                        sortOrder
                      )
                      if (result.error) alert(result.error)
                      else {
                        patchCameraDealerLinks(dealerAssigningId, (links) =>
                          links.map((l) =>
                            l.dealer_id === dealer.id ? { ...l, sort_order: sortOrder } : l
                          )
                        )
                      }
                    }}
                    onAssign={async () => {
                      try {
                        setAssigningDealerId(dealer.id)
                        const result = await assignCameraToDealer(dealerAssigningId, dealer.id)
                        if (result?.success) {
                          const cam = camerasState.find((c) => c.id === dealerAssigningId)
                          const maxSort = Math.max(
                            0,
                            ...(cam?.dealer_cameras ?? []).map((d) => d.sort_order ?? 0)
                          )
                          patchCameraDealerLinks(dealerAssigningId, (links) => {
                            if (links.some((l) => l.dealer_id === dealer.id)) return links
                            return [
                              ...links,
                              {
                                dealer_id: dealer.id,
                                camera_model_id: dealerAssigningId,
                                sort_order: maxSort + 10,
                                dealers: dealer,
                              },
                            ]
                          })
                        } else {
                          if (result?.error && !result.error.includes('already assigned')) {
                            alert(result.error || 'Failed to assign camera')
                          }
                        }
                      } catch (error) {
                        alert(error instanceof Error ? error.message : 'Failed to assign camera')
                      } finally {
                        setAssigningDealerId(null)
                      }
                    }}
                    onRemove={async () => {
                      try {
                        setRemovingDealerId(dealer.id)
                        const result = await removeCameraFromDealer(dealerAssigningId, dealer.id)
                        if (result?.success) {
                          patchCameraDealerLinks(dealerAssigningId, (links) =>
                            links.filter((l) => l.dealer_id !== dealer.id)
                          )
                        } else {
                          alert(result?.error || 'Failed to remove camera')
                        }
                      } catch (error) {
                        alert(error instanceof Error ? error.message : 'Failed to remove camera')
                      } finally {
                        setRemovingDealerId(null)
                      }
                    }}
                    isAssigning={assigningDealerId === dealer.id}
                    isRemoving={removingDealerId === dealer.id}
                  />
                ))}
              </div>
              <div className="pt-4 border-t border-zinc-200 dark:border-gray-800">
                <button
                  onClick={() => setDealerAssigningId(null)}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

const AssignedDealerSortRow = memo(function AssignedDealerSortRow({
  dealerName,
  dealerCode,
  sortOrder,
  onSave,
}: {
  dealerName: string
  dealerCode?: string
  sortOrder: number
  onSave: (sortOrder: number) => Promise<void>
}) {
  const [value, setValue] = useState(String(sortOrder))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(String(sortOrder))
  }, [sortOrder])

  return (
    <li className="flex items-center gap-3 text-sm">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const parsed = parseInt(value, 10)
          if (!Number.isFinite(parsed) || parsed === sortOrder) return
          setSaving(true)
          void onSave(parsed).finally(() => setSaving(false))
        }}
        disabled={saving}
        className="w-16 rounded border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-2 py-1 text-xs tabular-nums"
        title="Lower = first in booking dropdown"
      />
      <span className="text-zinc-900 dark:text-white">
        {dealerName}
        {dealerCode ? <span className="text-zinc-500 ml-1">({dealerCode})</span> : null}
      </span>
    </li>
  )
})

const DealerAssignmentItem = memo(function DealerAssignmentItem({
  dealer,
  cameraId,
  initialSortOrder,
  onSortSave,
  onAssign,
  onRemove,
  isAssigning,
  isRemoving,
}: {
  dealer: Dealer
  cameraId: string
  initialSortOrder?: number
  onSortSave: (sortOrder: number) => Promise<void>
  onAssign: () => Promise<void>
  onRemove: () => Promise<void>
  isAssigning?: boolean
  isRemoving?: boolean
}) {
  const [isAssigned, setIsAssigned] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sortOrder, setSortOrder] = useState(initialSortOrder ?? 0)

  useEffect(() => {
    setSortOrder(initialSortOrder ?? 0)
  }, [initialSortOrder])

  useEffect(() => {
    // Check if camera is assigned to this dealer
    const checkAssignment = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('dealer_cameras')
        .select('id, sort_order')
        .eq('camera_model_id', cameraId)
        .eq('dealer_id', dealer.id)
        .maybeSingle()
      setIsAssigned(!!data)
      if (data?.sort_order != null) setSortOrder(Number(data.sort_order))
    }
    checkAssignment()
  }, [cameraId, dealer.id])

  const handleToggle = async () => {
    setIsLoading(true)
    try {
      if (isAssigned) {
        await onRemove()
        setIsAssigned(false)
      } else {
        await onAssign()
        setIsAssigned(true)
      }
    } catch (error) {
      console.error('Error toggling assignment:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
      isAssigned
        ? 'bg-[#C27E00]/10 border-[#C27E00]/40 shadow-sm'
        : 'bg-zinc-200/50 dark:bg-white/5 border-zinc-200 dark:border-gray-800 hover:bg-zinc-200 dark:bg-white/10'
    }`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {isAssigned ? (
          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[#C27E00]"></div>
        ) : (
          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-transparent"></div>
        )}
        <div className="min-w-0 flex-1">
          <span className={`text-sm block truncate ${isAssigned ? 'text-zinc-900 dark:text-white font-medium' : 'text-zinc-600 dark:text-gray-300'}`}>
            {dealer.name}
          </span>
          <span className="text-xs text-zinc-500 dark:text-gray-500">({dealer.code})</span>
        </div>
      </div>
      {isAssigned && (
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
          onBlur={() => void onSortSave(sortOrder)}
          title="Booking order"
          className="w-14 rounded border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-1.5 py-1 text-xs tabular-nums"
        />
      )}
      <button
        onClick={handleToggle}
        disabled={isLoading || isAssigning || isRemoving}
        className={`flex-shrink-0 px-4 py-1.5 rounded-md text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          isAssigned
            ? 'bg-red-900/60 text-red-200 hover:bg-red-900/80 border border-red-800/50'
            : 'bg-[#C27E00] text-white hover:bg-[#a06900] border border-[#C27E00]/50'
        }`}
      >
        {isLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
        ) : (
          isAssigned ? 'Remove' : 'Assign'
        )}
      </button>
    </div>
  )
})

