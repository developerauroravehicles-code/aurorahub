'use client'
import { approveDemand, cancelDemand } from './actions'
import { useState } from 'react'

export function DemandActions({ demandId }: { demandId: string }) {
    const [loading, setLoading] = useState(false)

    const handleApprove = async () => {
        setLoading(true)
        await approveDemand(demandId)
        setLoading(false)
    }

    const handleCancel = async () => {
        if(!confirm('Are you sure you want to cancel this demand?')) return
        setLoading(true)
        await cancelDemand(demandId)
        setLoading(false)
    }

    return (
        <div className="space-x-2 flex">
            <button 
                onClick={handleApprove} 
                disabled={loading} 
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
            >
                {loading ? '...' : 'Approve'}
            </button>
            <button 
                onClick={handleCancel} 
                disabled={loading} 
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
            >
                {loading ? '...' : 'Cancel'}
            </button>
        </div>
    )
}

