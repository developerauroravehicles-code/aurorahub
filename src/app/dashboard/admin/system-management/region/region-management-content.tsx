'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RegionCodeManagement } from './region-code-management'
import { DealerRegionCodeAssignment } from './dealer-region-code-assignment'
import { DealerCameraManagement } from './dealer-camera-management'
import { Edit2, Trash2, MapPin } from 'lucide-react'

interface RegionCode {
  id: string
  code: string
  name: string
  description: string | null
}

interface Dealer {
  id: string
  name: string
  code: string
  address?: string
  region_code_id?: string | null
  region_codes?: RegionCode | null
  dealer_cameras?: any[]
}

interface CameraModel {
  id: string
  name: string
  is_active: boolean
}

export function RegionManagementContent({
  regionCodes,
  dealers,
  allDealers,
  cameraModels,
  createDealer,
  createRegionCode,
  updateDealerRegionCode,
  updateRegionCode,
  deleteRegionCode,
  addCameraToDealer,
  removeCameraFromDealer,
  updateDealer
}: {
  regionCodes: RegionCode[]
  dealers: Dealer[]
  allDealers: Dealer[]
  cameraModels: CameraModel[]
  createDealer: (formData: FormData) => Promise<void>
  createRegionCode: (formData: FormData) => Promise<void>
  updateDealerRegionCode: (dealerId: string, regionCodeId: string | null) => Promise<{ success: boolean; error?: string }>
  updateRegionCode: (regionCodeId: string, code: string, name: string, description: string | null) => Promise<void>
  deleteRegionCode: (regionCodeId: string) => Promise<void>
  addCameraToDealer: (dealerId: string, cameraModelId: string) => Promise<void>
  removeCameraFromDealer: (dealerId: string, cameraModelId: string) => Promise<void>
  updateDealer: (formData: FormData) => Promise<void>
}) {
  const router = useRouter()
  const [editingDealerId, setEditingDealerId] = useState<string | null>(null)

  const handleCreateDealer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      const formData = new FormData(e.currentTarget)
      await createDealer(formData)
      e.currentTarget.reset()
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create dealer')
    }
  }

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

  return (
    <div className="space-y-8">
      {/* Region Codes Management */}
      <div>
        <h2 className="text-lg font-medium mb-4 text-white">Region Codes Management</h2>
        <RegionCodeManagement 
          regionCodes={regionCodes} 
          createRegionCode={createRegionCode}
          updateRegionCode={updateRegionCode}
          deleteRegionCode={deleteRegionCode}
        />
      </div>

      {/* Dealers List */}
      <div>
        <h1 className="text-2xl font-semibold mb-4 text-white">Dealers</h1>
        <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
          <ul className="divide-y divide-gray-800">
            {dealers.map(d => {
              const regionCode = d.region_codes || (d.region_code_id ? regionCodes.find(rc => rc.id === d.region_code_id) : null)
              const isEditing = editingDealerId === d.id
              return (
                <li key={d.id} className="px-4 py-4 hover:bg-white/5 transition-colors">
                  {isEditing ? (
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
                  ) : (
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <p className="font-bold text-white text-lg">{d.name} <span className="text-sm font-normal text-gray-400">({d.code})</span></p>
                          {regionCode && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/50 text-blue-300 rounded border border-blue-800 font-medium text-sm">
                              <MapPin className="w-4 h-4" />
                              {regionCode.code} - {regionCode.name}
                            </span>
                          )}
                          {!regionCode && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/50 text-gray-400 rounded border border-gray-700 font-medium text-sm">
                              <MapPin className="w-4 h-4" />
                              No Region
                            </span>
                          )}
                        </div>
                        {d.address && (
                          <p className="text-sm text-gray-500 mb-2">{d.address}</p>
                        )}
                        {d.dealer_cameras && d.dealer_cameras.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-400 mb-1">Assigned Cameras:</p>
                            <div className="flex flex-wrap gap-1">
                              {d.dealer_cameras.map((dc: any) => (
                                <span 
                                  key={dc.camera_model_id} 
                                  className="text-xs px-2 py-1 bg-[#C27E00]/20 text-[#C27E00] rounded border border-[#C27E00]/30"
                                >
                                  {dc.camera_models?.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingDealerId(d.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1"
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
                          assignedCameras={d.dealer_cameras || []}
                          allCameras={cameraModels}
                          addCameraToDealer={addCameraToDealer}
                          removeCameraFromDealer={removeCameraFromDealer}
                        />
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* Add New Dealer */}
      <div className="bg-white/5 p-6 rounded-lg border border-gray-800 shadow max-w-lg">
        <h2 className="text-lg font-medium mb-4 text-white">Add New Dealer</h2>
        <form onSubmit={handleCreateDealer} className="space-y-4">
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
}

