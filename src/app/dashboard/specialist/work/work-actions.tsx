'use client'
import { assignWorkToMe, completeDemand } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function WorkActions({ demandId, isAssigned, vinLast6 }: { demandId: string; isAssigned: boolean; vinLast6?: string | null }) {
    const [loading, setLoading] = useState(false)
    const [directComplete, setDirectComplete] = useState(false)
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
        let vinInput: string | undefined
        let skipVinCheck = false
        if (directComplete && vinLast6) {
            vinInput = vinLast6.trim()
        } else if (directComplete && !vinLast6) {
            skipVinCheck = true
        } else {
            const entered = prompt('Enter VIN last 6 digits to complete this demand:')
            if (entered === null) return
            vinInput = entered
        }
        setLoading(true)
        const result = await completeDemand(demandId, vinInput, skipVinCheck ? { skipVinCheck: true } : undefined)
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={directComplete}
                    onChange={(e) => setDirectComplete(e.target.checked)}
                    className="rounded border-gray-600 bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-0"
                />
                <span className="text-sm text-gray-300">Direct complete (use stored VIN)</span>
            </label>
            <button 
                onClick={handleComplete} 
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors"
            >
                {loading ? 'Completing...' : 'Complete Job'}
            </button>
        </div>
    )
}

