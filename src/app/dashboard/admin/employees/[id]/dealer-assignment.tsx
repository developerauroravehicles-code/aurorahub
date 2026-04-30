'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { assignDealerToSpecialist, removeDealerFromSpecialist } from './actions'

interface Dealer {
  id: string
  name: string
}

interface AssignedDealer {
  id: string
  dealer_id: string
  dealers: {
    name: string
  }
}

interface DealerAssignmentProps {
  specialistId: string
  assignedDealers: AssignedDealer[]
  availableDealers: Dealer[]
}

export function DealerAssignment({ 
  specialistId, 
  assignedDealers, 
  availableDealers 
}: DealerAssignmentProps) {
  const [selectedDealerId, setSelectedDealerId] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [isRemoving, setIsRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filter out already assigned dealers
  const unassignedDealers = availableDealers.filter(
    dealer => !assignedDealers.some(ad => ad.dealer_id === dealer.id)
  )

  const handleAssign = async () => {
    if (!selectedDealerId) return

    setIsAssigning(true)
    setError(null)

    const result = await assignDealerToSpecialist(specialistId, selectedDealerId)
    
    if (result.success) {
      setSelectedDealerId('')
      // Reload the page to show updated assignments
      window.location.reload()
    } else {
      setError(result.error || 'Failed to assign dealer')
    }
    
    setIsAssigning(false)
  }

  const handleRemove = async (dealerId: string) => {
    setIsRemoving(dealerId)
    setError(null)

    const result = await removeDealerFromSpecialist(specialistId, dealerId)
    
    if (result.success) {
      // Reload the page to show updated assignments
      window.location.reload()
    } else {
      setError(result.error || 'Failed to remove dealer')
    }
    
    setIsRemoving(null)
  }

  return (
    <div className="bg-zinc-200/50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Dealer Assignments</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Assigned Dealers */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-3">Assigned Dealers ({assignedDealers.length})</h4>
        {assignedDealers.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-gray-500">No dealers assigned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assignedDealers.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center gap-2 px-3 py-2 bg-[#C27E00]/20 border border-[#C27E00]/50 rounded-md"
              >
                <span className="text-sm text-zinc-900 dark:text-white">{assignment.dealers.name}</span>
                <button
                  onClick={() => handleRemove(assignment.dealer_id)}
                  disabled={isRemoving === assignment.dealer_id}
                  className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  title="Remove dealer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Dealer */}
      {unassignedDealers.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-3">Assign New Dealer</h4>
          <div className="flex gap-2">
            <select
              value={selectedDealerId}
              onChange={(e) => setSelectedDealerId(e.target.value)}
              className="flex-1 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            >
              <option value="" className="bg-zinc-50 dark:bg-black">Select a dealer...</option>
              {unassignedDealers.map((dealer) => (
                <option key={dealer.id} value={dealer.id} className="bg-zinc-50 dark:bg-black">
                  {dealer.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAssign}
              disabled={!selectedDealerId || isAssigning}
              className="flex items-center gap-2 px-4 py-2 bg-[#C27E00] text-white rounded-md hover:bg-[#a06900] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Plus className="w-4 h-4" />
              {isAssigning ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      )}

      {unassignedDealers.length === 0 && assignedDealers.length > 0 && (
        <p className="text-sm text-zinc-500 dark:text-gray-500 mt-4">All available dealers are already assigned.</p>
      )}
    </div>
  )
}

