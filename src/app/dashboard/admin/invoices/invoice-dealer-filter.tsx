'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Dealer {
  id: string
  name: string
}

interface InvoiceDealerFilterProps {
  dealers: Dealer[]
  selectedDealerId: string
}

export function InvoiceDealerFilter({ dealers, selectedDealerId }: InvoiceDealerFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleDealerChange = (dealerId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (dealerId === 'all') {
      params.delete('dealer')
    } else {
      params.set('dealer', dealerId)
    }
    router.push(`/dashboard/admin/invoices?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-4">
      <label className="text-sm font-medium text-gray-400">Dealer:</label>
      <select
        value={selectedDealerId}
        onChange={(e) => handleDealerChange(e.target.value)}
        className="border border-gray-700 bg-white/5 px-3 py-2 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] min-w-[200px]"
      >
        <option value="all" className="bg-black">All Dealers</option>
        {dealers.map((d) => (
          <option key={d.id} value={d.id} className="bg-black">
            {d.name}
          </option>
        ))}
      </select>
    </div>
  )
}
