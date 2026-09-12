'use client'

import { useState, useEffect, useRef, memo } from 'react'
import { useRouter } from 'next/navigation'

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
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  const assignedCameraIds = assignedCameras.map((ac) => ac.camera_model_id)
  const availableCameras = allCameras.filter((c) => !assignedCameraIds.includes(c.id))
  const sortedAssigned = [...assignedCameras].sort(
    (a, b) => a.sort_order - b.sort_order || (a.camera_models?.name ?? '').localeCompare(b.camera_models?.name ?? '')
  )

  const handleAddCamera = async (cameraId: string) => {
    setIsLoading(true)
    try {
      const result = await addCameraToDealer(dealerId, cameraId)
      if (result.success) {
        router.refresh()
      } else if (result.error && !result.error.includes('already assigned')) {
        alert(result.error || 'Failed to add camera. Please try again.')
      }
    } catch (error) {
      console.error('Error adding camera:', error)
      alert('Failed to add camera. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveCamera = async (cameraId: string) => {
    setIsLoading(true)
    try {
      const result = await removeCameraFromDealer(dealerId, cameraId)
      if (result.success) {
        router.refresh()
      } else {
        alert(result.error || 'Failed to remove camera. Please try again.')
      }
    } catch (error) {
      console.error('Error removing camera:', error)
      alert('Failed to remove camera. Please try again.')
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
        router.refresh()
      } else {
        alert(result.error || 'Failed to update sort order.')
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
            Booking order: lower number appears first for this dealer.
          </p>

          {sortedAssigned.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-zinc-500 dark:text-gray-400 mb-2">Assigned cameras:</p>
              <div className="space-y-1">
                {sortedAssigned.map((ac) => (
                  <div
                    key={ac.camera_model_id}
                    className="flex items-center gap-2 p-2 bg-zinc-200/50 dark:bg-white/5 rounded text-sm"
                  >
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
