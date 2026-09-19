'use client'

import { useState, useEffect, useRef, memo, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface CameraModel {
  id: string
  name: string
  is_active: boolean
}

interface AssignedCamera {
  camera_model_id: string
  sort_order: number
  camera_models: CameraModel | null
}

export const DealerCameraManagement = memo(function DealerCameraManagement({
  dealerId,
  dealerName,
  assignedCameras,
  allCameras,
  addCameraToDealer,
  removeCameraFromDealer,
  updateDealerCameraSortOrder,
  reorderDealerCamera,
}: {
  dealerId: string
  dealerName: string
  assignedCameras: AssignedCamera[]
  allCameras: CameraModel[]
  addCameraToDealer: (dealerId: string, cameraModelId: string) => Promise<{ success: boolean; error?: string }>
  removeCameraFromDealer: (dealerId: string, cameraModelId: string) => Promise<{ success: boolean; error?: string }>
  updateDealerCameraSortOrder: (
    dealerId: string,
    cameraModelId: string,
    sortOrder: number
  ) => Promise<{ success: boolean; error?: string }>
  reorderDealerCamera: (
    dealerId: string,
    cameraModelId: string,
    direction: 'up' | 'down'
  ) => Promise<{
    success: boolean
    error?: string
    items?: { camera_model_id: string; sort_order: number }[]
  }>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [listOverride, setListOverride] = useState<AssignedCamera[] | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setListOverride(null)
  }, [assignedCameras, dealerId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const displayAssigned = listOverride ?? assignedCameras
  const assignedCameraIds = displayAssigned.map((ac) => ac.camera_model_id)
  const availableCameras = allCameras.filter((c) => !assignedCameraIds.includes(c.id))
  const sortedAssigned = useMemo(
    () =>
      [...displayAssigned].sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          (a.camera_models?.name ?? '').localeCompare(b.camera_models?.name ?? '')
      ),
    [displayAssigned]
  )

  function applyReorderToList(
    list: AssignedCamera[],
    cameraModelId: string,
    direction: 'up' | 'down'
  ): AssignedCamera[] | null {
    const sorted = [...list].sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        (a.camera_models?.name ?? '').localeCompare(b.camera_models?.name ?? '')
    )
    const idx = sorted.findIndex((a) => a.camera_model_id === cameraModelId)
    if (idx < 0) return null
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= sorted.length) return sorted
    ;[sorted[idx], sorted[targetIdx]] = [sorted[targetIdx]!, sorted[idx]!]
    return sorted.map((row, i) => ({ ...row, sort_order: (i + 1) * 10 }))
  }

  const handleAddCamera = async (cameraId: string) => {
    setActionError(null)
    setIsLoading(true)
    const previous = listOverride ?? assignedCameras
    const cam = allCameras.find((c) => c.id === cameraId)
    const maxSort = Math.max(0, ...previous.map((a) => a.sort_order))
    const optimistic: AssignedCamera[] = [
      ...previous,
      {
        camera_model_id: cameraId,
        sort_order: maxSort + 10,
        camera_models: cam ?? null,
      },
    ]
    setListOverride(optimistic)
    try {
      const result = await addCameraToDealer(dealerId, cameraId)
      if (result.success) {
        // keep panel open — no full-page refresh
      } else if (result.error && !result.error.includes('already assigned')) {
        setListOverride(previous)
        setActionError(result.error || 'Failed to add camera.')
      }
    } catch (error) {
      setListOverride(previous)
      setActionError(error instanceof Error ? error.message : 'Failed to add camera.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveCamera = async (cameraId: string) => {
    setActionError(null)
    setIsLoading(true)
    const previous = listOverride ?? assignedCameras
    setListOverride(previous.filter((a) => a.camera_model_id !== cameraId))
    try {
      const result = await removeCameraFromDealer(dealerId, cameraId)
      if (!result.success) {
        setListOverride(previous)
        setActionError(result.error || 'Failed to remove camera.')
      }
    } catch (error) {
      setListOverride(previous)
      setActionError(error instanceof Error ? error.message : 'Failed to remove camera.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReorder = async (cameraId: string, direction: 'up' | 'down') => {
    setActionError(null)
    const optimistic = applyReorderToList(displayAssigned, cameraId, direction)
    if (!optimistic) return
    const previous = listOverride ?? assignedCameras
    setListOverride(optimistic)
    setIsLoading(true)
    try {
      const result = await reorderDealerCamera(dealerId, cameraId, direction)
      if (result.success) {
        if (result.items?.length) {
          const byId = new Map(displayAssigned.map((a) => [a.camera_model_id, a]))
          setListOverride(
            result.items.map((item) => {
              const base = byId.get(item.camera_model_id)
              return base
                ? { ...base, sort_order: item.sort_order }
                : {
                    camera_model_id: item.camera_model_id,
                    sort_order: item.sort_order,
                    camera_models: null,
                  }
            })
          )
        }
      } else {
        setListOverride(previous)
        setActionError(result.error || 'Failed to reorder.')
      }
    } catch (error) {
      setListOverride(previous)
      setActionError(error instanceof Error ? error.message : 'Failed to reorder.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSortOrderBlur = async (cameraId: string, value: string, previous: number) => {
    const parsed = parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed === previous) return

    setIsLoading(true)
    try {
      const result = await updateDealerCameraSortOrder(dealerId, cameraId, parsed)
      if (result.success) {
        setListOverride((prev) => {
          const base = prev ?? assignedCameras
          return base.map((row) =>
            row.camera_model_id === cameraId ? { ...row, sort_order: parsed } : row
          )
        })
      } else {
        setActionError(result.error || 'Failed to update sort order.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="text-sm px-3 py-1 bg-[#C27E00] text-white rounded hover:bg-[#a06900] transition-colors disabled:opacity-50"
      >
        {isOpen ? 'Close' : 'Manage Cameras'}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-gray-700 rounded-lg shadow-xl z-10 p-4">
          <h3 className="text-zinc-900 dark:text-white font-semibold mb-1 text-sm">
            Cameras for {dealerName}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-gray-400 mb-3">
            Order below matches the Camera Model dropdown on Create Demand for this dealer (Sales / Finance).
          </p>
          {actionError && (
            <p className="text-xs text-red-500 mb-2" role="alert">
              {actionError}
            </p>
          )}

          {sortedAssigned.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-zinc-500 dark:text-gray-400 mb-2">Assigned cameras (top = first in list):</p>
              <div className="space-y-1">
                {sortedAssigned.map((ac, index) => (
                  <div
                    key={ac.camera_model_id}
                    className="flex items-center gap-2 p-2 bg-zinc-200/50 dark:bg-white/5 rounded text-sm"
                  >
                    <div className="flex flex-col shrink-0">
                      <button
                        type="button"
                        disabled={isLoading || index === 0}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          void handleReorder(ac.camera_model_id, 'up')
                        }}
                        className="p-0.5 rounded text-zinc-500 hover:text-[#C27E00] disabled:opacity-30"
                        title="Move up"
                        aria-label="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isLoading || index === sortedAssigned.length - 1}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          void handleReorder(ac.camera_model_id, 'down')
                        }}
                        className="p-0.5 rounded text-zinc-500 hover:text-[#C27E00] disabled:opacity-30"
                        title="Move down"
                        aria-label="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <label className="sr-only" htmlFor={`sort-${dealerId}-${ac.camera_model_id}`}>
                      Sort order
                    </label>
                    <input
                      id={`sort-${dealerId}-${ac.camera_model_id}`}
                      type="number"
                      defaultValue={ac.sort_order}
                      disabled={isLoading}
                      onBlur={(e) => void handleSortOrderBlur(ac.camera_model_id, e.target.value, ac.sort_order)}
                      className="w-14 rounded border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-2 py-1 text-xs tabular-nums"
                      title="Display order (lower = first)"
                    />
                    <span className="flex-1 text-zinc-900 dark:text-white truncate">
                      {ac.camera_models?.name || 'Unknown'}
                    </span>
                    <button
                      onClick={() => void handleRemoveCamera(ac.camera_model_id)}
                      disabled={isLoading}
                      className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded disabled:opacity-50 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {availableCameras.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 dark:text-gray-400 mb-2">Available cameras:</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {availableCameras.map((camera) => (
                  <button
                    key={camera.id}
                    onClick={() => void handleAddCamera(camera.id)}
                    disabled={isLoading}
                    className="w-full text-left p-2 bg-zinc-200/50 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded text-sm text-zinc-900 dark:text-white transition-colors disabled:opacity-50"
                  >
                    + {camera.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableCameras.length === 0 && sortedAssigned.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-gray-500 text-center py-2">
              All cameras are assigned
            </p>
          )}

          {allCameras.length === 0 && (
            <p className="text-xs text-zinc-500 dark:text-gray-500 text-center py-2">
              No cameras available. Add cameras first.
            </p>
          )}
        </div>
      )}
    </div>
  )
})
