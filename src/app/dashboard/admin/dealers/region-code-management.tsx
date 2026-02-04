'use client'

import { useState } from 'react'
import { createRegionCode } from './actions'
import { useRouter } from 'next/navigation'

interface RegionCode {
  id: string
  code: string
  name: string
  description: string | null
}

export function RegionCodeManagement({ 
  regionCodes, 
  createRegionCode 
}: { 
  regionCodes: RegionCode[]
  createRegionCode: (formData: FormData) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      await createRegionCode(formData)
      setShowForm(false)
      router.refresh()
      e.currentTarget.reset()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create region code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Region Codes List */}
      {regionCodes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {regionCodes.map(rc => (
            <div key={rc.id} className="bg-white/5 border border-gray-800 p-3 rounded">
              <p className="font-medium text-white">
                <span className="text-[#C27E00]">{rc.code}</span> - {rc.name}
              </p>
              {rc.description && (
                <p className="text-xs text-gray-400 mt-1">{rc.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Region Code Form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#C27E00] text-white px-4 py-2 rounded hover:bg-[#a06900] transition-colors text-sm"
        >
          + Add Region Code
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 bg-white/5 p-4 rounded border border-gray-800">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Region Code</label>
            <input 
              name="code" 
              required 
              className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] text-sm"
              placeholder="e.g. REG001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Region Name</label>
            <input 
              name="name" 
              required 
              className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] text-sm"
              placeholder="e.g. North Region"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description (Optional)</label>
            <input 
              name="description" 
              className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] text-sm"
              placeholder="Optional description"
            />
          </div>
          <div className="flex gap-2">
            <button 
              type="submit"
              disabled={loading}
              className="bg-[#C27E00] text-white px-4 py-2 rounded hover:bg-[#a06900] transition-colors text-sm disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
              }}
              className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

