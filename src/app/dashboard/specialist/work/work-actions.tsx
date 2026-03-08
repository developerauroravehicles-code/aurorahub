'use client'
import { assignWorkToMe, completeDemand } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function WorkActions({ demandId, isAssigned, vinLast6 }: { demandId: string; isAssigned: boolean; vinLast6?: string | null }) {
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
        const entered = prompt('Enter VIN last 6 digits to complete this demand:')
        if (entered === null) return
        const vinInput = entered
        setLoading(true)
        const result = await completeDemand(demandId, vinInput)
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

