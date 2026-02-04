'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RegionCodeManagement } from './region-code-management'
import { DealerRegionCodeAssignment } from './dealer-region-code-assignment'
import { DealerCameraManagement } from './dealer-camera-management'
import { Edit2, Trash2 } from 'lucide-react'

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
  removeCameraFromDealer
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
}) {
  const router = useRouter()

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
              return (
                <li key={d.id} className="px-4 py-4 hover:bg-white/5 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-bold text-white">{d.name} <span className="text-sm font-normal text-gray-400">({d.code})</span></p>
                      </div>
                      {regionCode ? (
                        <div className="mb-2">
                          <p className="text-xs text-gray-400 mb-1">Region Code:</p>
                          <span className="inline-flex items-center px-3 py-1.5 bg-blue-900/50 text-blue-300 rounded border border-blue-800 font-medium">
                            {regionCode.code} - {regionCode.name}
                          </span>
                        </div>
                      ) : (
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 italic">No region code assigned</p>
                        </div>
                      )}
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

