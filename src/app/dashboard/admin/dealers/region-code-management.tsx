'use client'

import { useState } from 'react'
import { createRegionCode, updateRegionCode, deleteRegionCode } from './actions'
import { useRouter } from 'next/navigation'
import { Edit2, Trash2 } from 'lucide-react'

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const form = e.currentTarget
    try {
      const formData = new FormData(form)
      await createRegionCode(formData)
      form.reset()
      setShowForm(false)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create region code')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>, regionCodeId: string) => {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const code = formData.get('code') as string
      const name = formData.get('name') as string
      const description = formData.get('description') as string
      await updateRegionCode(regionCodeId, code, name, description || null)
      setEditingId(null)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update region code')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (regionCodeId: string) => {
    if (!confirm('Are you sure you want to delete this region code? This will remove it from all dealers.')) {
      return
    }
    setLoading(true)
    try {
      await deleteRegionCode(regionCodeId)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete region code')
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
            <div key={rc.id} className="bg-white/5 border border-gray-800 p-3 rounded relative group">
              {editingId === rc.id ? (
                <form onSubmit={(e) => handleUpdate(e, rc.id)} className="space-y-2">
                  <div>
                    <input 
                      name="code" 
                      defaultValue={rc.code}
                      required 
                      className="border border-gray-700 bg-white/5 p-1.5 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] text-sm"
                      placeholder="Code"
                    />
                  </div>
                  <div>
                    <input 
                      name="name" 
                      defaultValue={rc.name}
                      required 
                      className="border border-gray-700 bg-white/5 p-1.5 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] text-sm"
                      placeholder="Name"
                    />
                  </div>
                  <div>
                    <input 
                      name="description" 
                      defaultValue={rc.description || ''}
                      className="border border-gray-700 bg-white/5 p-1.5 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] text-sm"
                      placeholder="Description (optional)"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="submit"
                      disabled={loading}
                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="bg-gray-700 text-white px-3 py-1 rounded text-xs hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-white">
                        <span className="text-[#C27E00]">{rc.code}</span> - {rc.name}
                      </p>
                      {rc.description && (
                        <p className="text-xs text-gray-400 mt-1">{rc.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingId(rc.id)}
                        className="p-1.5 text-blue-400 hover:bg-blue-900/20 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(rc.id)}
                        disabled={loading}
                        className="p-1.5 text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
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
        <form onSubmit={handleCreate} className="space-y-3 bg-white/5 p-4 rounded border border-gray-800">
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

