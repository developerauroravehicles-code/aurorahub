'use client'
import { approveDemand, cancelDemand, assignDemandToMe } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DemandActions({ demandId, isAssigned }: { demandId: string, isAssigned: boolean }) {
    const [loading, setLoading] = useState(false)
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

    const handleApprove = async () => {
        setLoading(true)
        const result = await approveDemand(demandId)
        if (result?.error) {
            alert(result.error)
        } else {
            router.refresh()
        }
        setLoading(false)
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

    return (
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
    )
}

