'use client'

import { Loader2, Search } from 'lucide-react'
import { isValidVinQuery } from '@/lib/customer-portal-utils'

type Props = {
  vin: string
  onVinChange: (value: string) => void
  onSubmit: () => void
  loading: boolean
}

export function VinLookupForm({ vin, onVinChange, onSubmit, loading }: Props) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="vin" className="block text-sm font-medium text-zinc-900 dark:text-zinc-200 mb-1.5">
          VIN number
        </label>
        <input
          id="vin"
          name="vin"
          value={vin}
          onChange={(e) => onVinChange(e.target.value)}
          autoComplete="off"
          maxLength={32}
          className="block w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-[#C27E00] focus:outline-none focus:ring-2 focus:ring-[#C27E00]/30 sm:text-sm"
          placeholder="Full 17-digit VIN or last 6 characters"
        />
        <p className="mt-2 text-xs text-zinc-500 dark:text-gray-500">
          We match against the vehicle identifier on file (typically the last 6 digits of your VIN).
        </p>
      </div>
      <button
        type="submit"
        disabled={loading || !isValidVinQuery(vin)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#C27E00] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#a06900] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Look up appointment
          </>
        )}
      </button>
    </form>
  )
}
