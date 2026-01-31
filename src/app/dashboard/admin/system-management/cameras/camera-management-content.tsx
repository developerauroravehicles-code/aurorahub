'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCameraModel, deleteCameraModel, toggleCameraModelStatus } from './actions'
import { Trash2, Power, PowerOff } from 'lucide-react'

interface CameraModel {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export function CameraManagementContent({ initialCameras }: { initialCameras: CameraModel[] }) {
  const [isPending, startTransition] = useTransition()
  const [newCameraName, setNewCameraName] = useState('')
  const [newCameraDescription, setNewCameraDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!newCameraName.trim()) {
      setError('Camera model name is required')
      return
    }

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('name', newCameraName)
        formData.append('description', newCameraDescription)
        
        await createCameraModel(formData)
        
        setNewCameraName('')
        setNewCameraDescription('')
        setSuccess('Camera model created successfully')
        router.refresh()
      } catch (err: any) {
        setError(err.message || 'Failed to create camera model')
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this camera model?')) return

    setError(null)
    setSuccess(null)

    startTransition(async () => {
      try {
        await deleteCameraModel(id)
        setSuccess('Camera model deleted successfully')
        router.refresh()
      } catch (err: any) {
        setError(err.message || 'Failed to delete camera model')
      }
    })
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      try {
        await toggleCameraModelStatus(id, !currentStatus)
        setSuccess(`Camera model ${!currentStatus ? 'activated' : 'deactivated'} successfully`)
        router.refresh()
      } catch (err: any) {
        setError(err.message || 'Failed to update camera model status')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Create New Camera Model */}
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Add New Camera Model</h2>
        
        {error && (
          <div className="bg-red-900/50 border border-red-800 text-red-200 p-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-900/50 border border-green-800 text-green-200 p-3 rounded-md text-sm mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Camera Model Name *
            </label>
            <input
              type="text"
              value={newCameraName}
              onChange={(e) => setNewCameraName(e.target.value)}
              required
              className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="e.g., Aurora Pro 4K"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={newCameraDescription}
              onChange={(e) => setNewCameraDescription(e.target.value)}
              rows={3}
              className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="Camera model description..."
            />
          </div>

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
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Camera Models ({initialCameras.length})
        </h2>

        {initialCameras.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No camera models found. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {initialCameras.map((camera) => (
              <div
                key={camera.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  camera.is_active 
                    ? 'bg-white/5 border-gray-800' 
                    : 'bg-white/2 border-gray-900 opacity-60'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-white font-medium">{camera.name}</h3>
                    {!camera.is_active && (
                      <span className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-400">
                        Inactive
                      </span>
                    )}
                  </div>
                  {camera.description && (
                    <p className="text-sm text-gray-400 mt-1">{camera.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(camera.id, camera.is_active)}
                    disabled={isPending}
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
                    disabled={isPending}
                    className="p-2 rounded text-red-500 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

