'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RegionCode {
  id: string
  code: string
  name: string
}

export function DealerRegionCodeAssignment({
  dealerId,
  dealerName,
  currentRegionCodeId,
  regionCodes,
  updateDealerRegionCode
}: {
  dealerId: string
  dealerName: string
  currentRegionCodeId: string | null
  regionCodes: RegionCode[]
  updateDealerRegionCode: (dealerId: string, regionCodeId: string | null) => Promise<{ success: boolean; error?: string }>
}) {
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const regionCodeId = formData.get('region_code_id') as string
      const result = await updateDealerRegionCode(dealerId, regionCodeId === 'none' ? null : regionCodeId)
      if (result.success) {
        setShowModal(false)
        router.refresh()
      } else {
        alert(result.error || 'Failed to update region code')
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update region code')
    } finally {
      setLoading(false)
    }
  }

  const currentRegionCode = regionCodes.find(rc => rc.id === currentRegionCodeId)

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
      >
        {currentRegionCode ? `Region: ${currentRegionCode.code}` : 'Assign Region'}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-black border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              Assign Region Code to {dealerName}
            </h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Region Code
                </label>
                <select
                  name="region_code_id"
                  defaultValue={currentRegionCodeId || 'none'}
                  className="w-full border border-gray-700 bg-white/5 p-2 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                >
                  <option value="none" className="bg-black text-white">No Region Code</option>
                  {regionCodes.map(rc => (
                    <option key={rc.id} value={rc.id} className="bg-black text-white">
                      {rc.code} - {rc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#C27E00] text-white px-4 py-2 rounded hover:bg-[#a06900] transition-colors disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

