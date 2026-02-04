'use client'
import { assignWorkToMe, completeDemand } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function WorkActions({ demandId, isAssigned }: { demandId: string, isAssigned: boolean }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleAssign = async () => {
        setLoading(true)
        const result = await assignWorkToMe(demandId)
        if (result?.error) {
            alert(result.error)
        } else {
            router.refresh()
        }
        setLoading(false)
    }

    const handleComplete = async () => {
        if(!confirm('Mark this job as completed?')) return
        setLoading(true)
        const result = await completeDemand(demandId)
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
        <button 
            onClick={handleComplete} 
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors"
        >
            {loading ? 'Completing...' : 'Complete Job'}
        </button>
    )
}

