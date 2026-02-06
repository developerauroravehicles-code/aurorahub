'use client'

import { useState, useEffect } from 'react'
import { updateDemand, revertDemandToPending } from './actions'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

interface Demand {
  id: string
  customer_firstname: string
  customer_lastname: string
  customer_phone: string
  customer_address: string | null
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  stock_number: string | null
  camera_model: string
  appointment_date: string
}

interface EditDemandModalProps {
  demand: Demand
  isOpen: boolean
  onClose: () => void
}

export function EditDemandModal({ demand, isOpen, onClose }: EditDemandModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    customer_firstname: demand.customer_firstname,
    customer_lastname: demand.customer_lastname,
    customer_phone: demand.customer_phone,
    customer_address: demand.customer_address || '',
    vehicle_make: demand.vehicle_make,
    vehicle_model: demand.vehicle_model,
    vehicle_year: demand.vehicle_year,
    stock_number: demand.stock_number || '',
    camera_model: demand.camera_model,
    appointment_date: format(new Date(demand.appointment_date), "yyyy-MM-dd'T'HH:mm"),
  })

  useEffect(() => {
    if (isOpen) {
      setFormData({
        customer_firstname: demand.customer_firstname,
        customer_lastname: demand.customer_lastname,
        customer_phone: demand.customer_phone,
        customer_address: demand.customer_address || '',
        vehicle_make: demand.vehicle_make,
        vehicle_model: demand.vehicle_model,
        vehicle_year: demand.vehicle_year,
        stock_number: demand.stock_number || '',
        camera_model: demand.camera_model,
        appointment_date: format(new Date(demand.appointment_date), "yyyy-MM-dd'T'HH:mm"),
      })
      setError(null)
    }
  }, [isOpen, demand])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      form.append(key, value.toString())
    })

    const result = await updateDemand(demand.id, form)
    
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.refresh()
      onClose()
    }
  }

  const handleRevertToPending = async () => {
    if (!confirm('Are you sure you want to revert this demand to pending status? This will undo the approval.')) {
      return
    }

    setReverting(true)
    setError(null)

    const result = await revertDemandToPending(demand.id)
    
    if (result?.error) {
      setError(result.error)
      setReverting(false)
    } else {
      router.refresh()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-white">Edit Demand</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-800 text-red-200 p-4 rounded-md mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">First Name *</label>
                <input
                  type="text"
                  value={formData.customer_firstname}
                  onChange={(e) => setFormData({ ...formData, customer_firstname: e.target.value })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={formData.customer_lastname}
                  onChange={(e) => setFormData({ ...formData, customer_lastname: e.target.value })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.customer_address}
                  onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Vehicle Make *</label>
                <input
                  type="text"
                  value={formData.vehicle_make}
                  onChange={(e) => setFormData({ ...formData, vehicle_make: e.target.value })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Vehicle Model *</label>
                <input
                  type="text"
                  value={formData.vehicle_model}
                  onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Vehicle Year *</label>
                <input
                  type="number"
                  min="1900"
                  max="2100"
                  value={formData.vehicle_year}
                  onChange={(e) => setFormData({ ...formData, vehicle_year: parseInt(e.target.value) || 0 })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Stock Number</label>
                <input
                  type="text"
                  value={formData.stock_number}
                  onChange={(e) => setFormData({ ...formData, stock_number: e.target.value })}
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Camera Model *</label>
                <input
                  type="text"
                  value={formData.camera_model}
                  onChange={(e) => setFormData({ ...formData, camera_model: e.target.value })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Appointment Date & Time *</label>
                <input
                  type="datetime-local"
                  value={formData.appointment_date}
                  onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                  required
                  className="w-full border border-gray-700 bg-black/50 py-2 px-3 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={handleRevertToPending}
                disabled={loading || reverting}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded disabled:opacity-50 transition-colors text-sm"
              >
                {reverting ? 'Reverting...' : 'Revert to Pending'}
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || reverting}
                  className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] text-white rounded disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

