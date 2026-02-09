'use client'
import { cancelDemand, assignDemandToMe } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EditDemandModal } from './edit-demand-modal'
import { ApproveConfirmationModal } from './approve-confirmation-modal'

interface Demand {
  id: string
  dealer_id?: string | null
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
  assigned_specialist_id?: string | null
}

export function DemandActions({ demandId, isAssigned, status, demand }: { 
  demandId: string
  isAssigned: boolean
  status?: string
  demand?: Demand
}) {
    const [loading, setLoading] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showApproveModal, setShowApproveModal] = useState(false)
    const router = useRouter()

    const handleAssign = async () => {
        setLoading(true)
        const result = await assignDemandToMe(demandId)
        if (result?.error) {
            alert(result.error)
        } else {
            router.refresh()
        }
        setLoading(false)
    }

    const handleApprove = () => {
        setShowApproveModal(true)
    }

    const handleCancel = async () => {
        if(!confirm('Are you sure you want to cancel this demand?')) return
        setLoading(true)
        const result = await cancelDemand(demandId)
        if (result?.error) {
            alert(result.error)
        } else {
            router.refresh()
        }
        setLoading(false)
    }

    if (!isAssigned) {
        return (
            <button 
                onClick={handleAssign} 
                disabled={loading} 
                className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors"
            >
                {loading ? 'Assigning...' : 'Assign to Me'}
            </button>
        )
    }

    // If approved, show Edit button instead of Approve
    if (status === 'approved') {
        return (
            <>
                <div className="space-x-2 flex">
                    <button 
                        onClick={() => setShowEditModal(true)} 
                        disabled={loading} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition-colors"
                    >
                        Edit
                    </button>
                    <button 
                        onClick={handleCancel} 
                        disabled={loading} 
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition-colors"
                    >
                        {loading ? '...' : 'Cancel'}
                    </button>
                </div>
                {demand && (
                    <EditDemandModal
                        demand={demand}
                        isOpen={showEditModal}
                        onClose={() => setShowEditModal(false)}
                    />
                )}
            </>
        )
    }

    return (
        <>
            <div className="space-x-2 flex">
                <button 
                    onClick={handleApprove} 
                    disabled={loading} 
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition-colors"
                >
                    {loading ? '...' : 'Approve'}
                </button>
                <button 
                    onClick={handleCancel} 
                    disabled={loading} 
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition-colors"
                >
                    {loading ? '...' : 'Cancel'}
                </button>
            </div>
            <ApproveConfirmationModal
                demandId={demandId}
                isOpen={showApproveModal}
                onClose={() => setShowApproveModal(false)}
                hasAssignedSpecialist={!!demand?.assigned_specialist_id}
            />
        </>
    )
}

