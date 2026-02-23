'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteDemand } from './actions'

interface DeleteDemandButtonProps {
  demandId: string
  customerName: string
  appointmentDate: string
}

export function DeleteDemandButton({ demandId, customerName, appointmentDate }: DeleteDemandButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete this appointment?\n\nCustomer: ${customerName}\nDate: ${appointmentDate}\n\nThis action cannot be undone.`)) {
      return
    }

    setLoading(true)
    const result = await deleteDemand(demandId)
    if (result?.error) {
      alert(result.error)
      setLoading(false)
    } else {
      router.refresh()
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Trash2 className="w-4 h-4" />
      {loading ? 'Deleting...' : 'Delete Appointment'}
    </button>
  )
}
