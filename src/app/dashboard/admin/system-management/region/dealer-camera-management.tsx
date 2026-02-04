'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface CameraModel {
  id: string
  name: string
  is_active: boolean
}

interface AssignedCamera {
  camera_model_id: string
  camera_models: CameraModel | null
}

export function DealerCameraManagement({ 
  dealerId, 
  dealerName,
  assignedCameras,
  allCameras,
  addCameraToDealer,
  removeCameraFromDealer
}: { 
  dealerId: string
  dealerName: string
  assignedCameras: AssignedCamera[]
  allCameras: CameraModel[]
  addCameraToDealer: (dealerId: string, cameraModelId: string) => Promise<void>
  removeCameraFromDealer: (dealerId: string, cameraModelId: string) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
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

  const assignedCameraIds = assignedCameras.map(ac => ac.camera_model_id)
  const availableCameras = allCameras.filter(c => !assignedCameraIds.includes(c.id))

  const handleAddCamera = async (cameraId: string) => {
    setIsLoading(true)
    try {
      await addCameraToDealer(dealerId, cameraId)
      router.refresh()
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
      await removeCameraFromDealer(dealerId, cameraId)
      router.refresh()
    } catch (error) {
      console.error('Error removing camera:', error)
      alert('Failed to remove camera. Please try again.')
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
        <div className="absolute right-0 top-full mt-2 w-80 bg-black border border-gray-700 rounded-lg shadow-xl z-10 p-4">
          <h3 className="text-white font-semibold mb-3 text-sm">
            Cameras for {dealerName}
          </h3>

          {assignedCameras.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">Assigned Cameras:</p>
              <div className="space-y-1">
                {assignedCameras.map((ac) => (
                  <div
                    key={ac.camera_model_id}
                    className="flex items-center justify-between p-2 bg-white/5 rounded text-sm"
                  >
                    <span className="text-white">
                      {ac.camera_models?.name || 'Unknown'}
                    </span>
                    <button
                      onClick={() => handleRemoveCamera(ac.camera_model_id)}
                      disabled={isLoading}
                      className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded disabled:opacity-50"
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
              <p className="text-xs text-gray-400 mb-2">Available Cameras:</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {availableCameras.map((camera) => (
                  <button
                    key={camera.id}
                    onClick={() => handleAddCamera(camera.id)}
                    disabled={isLoading}
                    className="w-full text-left p-2 bg-white/5 hover:bg-white/10 rounded text-sm text-white transition-colors disabled:opacity-50"
                  >
                    + {camera.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableCameras.length === 0 && assignedCameras.length > 0 && (
            <p className="text-xs text-gray-500 text-center py-2">
              All cameras are assigned
            </p>
          )}

          {allCameras.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-2">
              No cameras available. Add cameras first.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

