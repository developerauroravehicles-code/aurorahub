'use client'

import { useState, memo } from 'react'
import { useRouter } from 'next/navigation'
import { DealerRegionCodeAssignment } from '../region/dealer-region-code-assignment'
import { DealerCameraManagement } from '../region/dealer-camera-management'
import { Edit2, Trash2, MapPin } from 'lucide-react'
import { updateDealer, deleteDealer } from '../region/actions'
import type { DealerCamera, Dealer, RegionCode } from '@/types/system-management'

interface CameraModel {
  id: string
  name: string
  is_active: boolean
}

export const DealerManagementContent = memo(function DealerManagementContent({
  dealers,
  regionCodes,
  cameraModels,
  updateDealerRegionCode,
  addCameraToDealer,
  removeCameraFromDealer
}: {
  dealers: Dealer[]
  regionCodes: RegionCode[]
  cameraModels: CameraModel[]
  updateDealerRegionCode: (dealerId: string, regionCodeId: string | null) => Promise<{ success: boolean; error?: string }>
  addCameraToDealer: (dealerId: string, cameraModelId: string) => Promise<{ success: boolean; error?: string }>
  removeCameraFromDealer: (dealerId: string, cameraModelId: string) => Promise<{ success: boolean; error?: string }>
}) {
  const router = useRouter()
  const [editingDealerId, setEditingDealerId] = useState<string | null>(null)
  const [deletingDealerId, setDeletingDealerId] = useState<string | null>(null)

  const handleUpdateDealer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      const formData = new FormData(e.currentTarget)
      await updateDealer(formData)
      setEditingDealerId(null)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update dealer')
    }
  }

  const handleDeleteDealer = async (dealerId: string, dealerName: string) => {
    if (!confirm(`Are you sure you want to delete "${dealerName}"? This will also remove all camera assignments for this dealer. This action cannot be undone.`)) {
      return
    }
    setDeletingDealerId(dealerId)
    try {
      await deleteDealer(dealerId)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete dealer')
    } finally {
      setDeletingDealerId(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Dealers List */}
      <div>
        <h1 className="text-2xl font-semibold mb-4 text-white">Dealers ({dealers.length})</h1>
        <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
          {/* Table View */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Region</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Address</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
            {dealers.map(d => {
              // Find region code - check both merged region_codes and region_code_id
              let regionCode = d.region_codes || null
              if (!regionCode && d.region_code_id) {
                regionCode = regionCodes.find(rc => rc.id === d.region_code_id) || null
              }
              const isEditing = editingDealerId === d.id
              const isDeleting = deletingDealerId === d.id
              
              if (isEditing) {
                return (
                  <tr key={d.id} className="bg-white/5">
                    <td colSpan={5} className="px-4 py-4">
                      <form onSubmit={handleUpdateDealer} className="space-y-4">
                        <input type="hidden" name="dealerId" value={d.id} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Dealer Name</label>
                            <input 
                              name="name" 
                              defaultValue={d.name}
                              required 
                              className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Dealer Code</label>
                            <input 
                              name="code" 
                              defaultValue={d.code}
                              required 
                              className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                            <input 
                              name="address" 
                              defaultValue={d.address || ''}
                              className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Region Code</label>
                            <select 
                              name="region_code_id" 
                              defaultValue={regionCode?.id || 'none'}
                              className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] text-sm"
                            >
                              <option value="none" className="bg-black text-white">No Region Code</option>
                              {regionCodes.map(rc => (
                                <option key={rc.id} value={rc.id} className="bg-black text-white">
                                  {rc.code} - {rc.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            type="submit"
                            className="bg-[#C27E00] text-white px-4 py-2 rounded hover:bg-[#a06900] transition-colors text-sm"
                          >
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDealerId(null)}
                            className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )
              }
              
              return (
                <tr key={d.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{d.name}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-[#C27E00]">{d.code}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {regionCode ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-900/50 text-blue-300 rounded border border-blue-800 text-xs font-medium">
                        <MapPin className="w-3.5 h-3.5" />
                        {regionCode.code} - {regionCode.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-800/50 text-gray-400 rounded border border-gray-700 text-xs font-medium">
                        <MapPin className="w-3.5 h-3.5" />
                        No Region
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-400">{d.address || '-'}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingDealerId(d.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <DealerRegionCodeAssignment 
                        dealerId={d.id}
                        dealerName={d.name}
                        currentRegionCodeId={regionCode?.id || null}
                        regionCodes={regionCodes}
                        updateDealerRegionCode={updateDealerRegionCode}
                      />
                      <DealerCameraManagement 
                        dealerId={d.id} 
                        dealerName={d.name}
                        assignedCameras={(d.dealer_cameras || []).map(dc => ({
                          camera_model_id: dc.camera_model_id,
                          camera_models: dc.camera_models ?? null
                        }))}
                        allCameras={cameraModels}
                        addCameraToDealer={addCameraToDealer}
                        removeCameraFromDealer={removeCameraFromDealer}
                      />
                      <button
                        onClick={() => handleDeleteDealer(d.id, d.name)}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add New Dealer */}
      <div className="bg-white/5 p-6 rounded-lg border border-gray-800 shadow max-w-lg">
        <h2 className="text-lg font-medium mb-4 text-white">Add New Dealer</h2>
        <form onSubmit={async (e) => {
          e.preventDefault()
          try {
            const formData = new FormData(e.currentTarget)
            const { createDealer } = await import('../actions')
            await createDealer(null, formData)
            e.currentTarget.reset()
            router.refresh()
          } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to create dealer')
          }
        }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Dealer Name</label>
            <input name="name" required className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Dealer Code</label>
            <input name="code" required className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] placeholder-gray-500" placeholder="e.g. KIASURREY" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Address</label>
            <input name="address" className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Region Code</label>
            <select name="region_code_id" className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]">
              <option value="none" className="bg-black text-white">No Region Code</option>
              {regionCodes.map(rc => (
                <option key={rc.id} value={rc.id} className="bg-black text-white">
                  {rc.code} - {rc.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="bg-[#C27E00] text-white px-4 py-2 rounded hover:bg-[#a06900] transition-colors">Add Dealer</button>
        </form>
      </div>
    </div>
  )
})

