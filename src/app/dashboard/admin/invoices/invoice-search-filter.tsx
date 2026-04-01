'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

export type InvoiceSearchBy = 'demand_number' | 'stock_number' | 'vin_last6'

const SEARCH_OPTIONS: { value: InvoiceSearchBy; label: string }[] = [
  { value: 'demand_number', label: 'Demand ID' },
  { value: 'stock_number', label: 'Stock #' },
  { value: 'vin_last6', label: 'VIN' }
]

interface InvoiceSearchFilterProps {
  searchValue: string
  searchBy: InvoiceSearchBy
}

export function InvoiceSearchFilter({ searchValue, searchBy }: InvoiceSearchFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [inputValue, setInputValue] = useState(searchValue)
  const [selectedBy, setSelectedBy] = useState<InvoiceSearchBy>(searchBy)

  useEffect(() => {
    setInputValue(searchValue)
    setSelectedBy(searchBy)
  }, [searchValue, searchBy])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value.toUpperCase())
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const value = inputValue.trim()
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('search', value)
      params.set('searchBy', selectedBy)
    } else {
      params.delete('search')
      params.delete('searchBy')
    }
    const q = params.toString()
    router.push(q ? `/dashboard/admin/invoices?${q}` : '/dashboard/admin/invoices')
  }

  const handleClear = () => {
    setInputValue('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('search')
    params.delete('searchBy')
    const q = params.toString()
    router.push(q ? `/dashboard/admin/invoices?${q}` : '/dashboard/admin/invoices')
  }

  const placeholder = selectedBy === 'demand_number' ? 'ARR20260000001' : selectedBy === 'stock_number' ? '6K0814' : 'Last 6 digits'

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <select
        value={selectedBy}
        onChange={(e) => setSelectedBy(e.target.value as InvoiceSearchBy)}
        className="border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 rounded text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] min-w-[110px]"
      >
        {SEARCH_OPTIONS.map(o => (
          <option key={o.value} value={o.value} className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
            {o.label}
          </option>
        ))}
      </select>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 dark:text-gray-500" />
        <input
          name="search"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 pl-8 pr-3 py-2 rounded text-zinc-900 dark:text-white text-sm placeholder-zinc-500 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] w-48 uppercase"
        />
      </div>
      <button
        type="submit"
        className="px-3 py-2 rounded text-sm font-medium bg-[#C27E00] hover:bg-[#a06900] text-white transition-colors"
      >
        Search
      </button>
      {(searchValue || inputValue) && (
        <button
          type="button"
          onClick={handleClear}
          className="px-2 py-2 rounded text-sm text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white transition-colors"
        >
          Clear
        </button>
      )}
    </form>
  )
}
