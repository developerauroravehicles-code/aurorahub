'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Dealer {
  id: string
  name: string
}

interface EmployeesDealerFilterProps {
  dealers: Dealer[]
  selectedDealerId: string
}

export function EmployeesDealerFilter({ dealers, selectedDealerId }: EmployeesDealerFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleDealerChange = (dealerId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (dealerId === 'platform') {
      params.delete('dealer')
    } else {
      params.set('dealer', dealerId)
    }
    router.push(`/dashboard/admin/employees?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-4 mb-4">
      <label className="text-sm font-medium text-gray-400">View:</label>
      <select
        value={selectedDealerId}
        onChange={(e) => handleDealerChange(e.target.value)}
        className="border border-gray-700 bg-white/5 px-3 py-2 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] min-w-[200px]"
      >
        <option value="platform" className="bg-black">Platform (Specialists, Aurora Manager, HR, IT)</option>
        {dealers.map((d) => (
          <option key={d.id} value={d.id} className="bg-black">
            {d.name} (Sales, Finance)
          </option>
        ))}
      </select>
    </div>
  )
}
