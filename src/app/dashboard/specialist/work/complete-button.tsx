'use client'
import { completeDemand } from './actions'
import { useState } from 'react'

export function CompleteButton({ demandId }: { demandId: string }) {
    const [loading, setLoading] = useState(false)
    
    const handleComplete = async () => {
        if(!confirm('Mark this job as completed?')) return
        setLoading(true)
        await completeDemand(demandId)
        setLoading(false)
    }

    return (
        <button 
            onClick={handleComplete} 
            disabled={loading}
            className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
        >
            {loading ? 'Completing...' : 'Complete Job'}
        </button>
    )
}

