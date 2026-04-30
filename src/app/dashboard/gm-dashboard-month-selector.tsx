'use client'

import { useRouter, useSearchParams } from 'next/navigation'

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    options.push({ value, label })
  }
  return options
}

export function GMDashboardMonthSelector({ currentMonth }: { currentMonth: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    const value = e.target.value
    if (value) {
      params.set('month', value)
    } else {
      params.delete('month')
    }
    router.push(`/dashboard?${params.toString()}`)
  }

  const options = getMonthOptions()

  return (
    <select
      value={currentMonth}
      onChange={handleChange}
      className="rounded border border-zinc-300 bg-zinc-100 px-2 py-1 text-xs text-zinc-900 cursor-pointer shadow-sm hover:bg-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#C27E00] dark:border-gray-600 dark:bg-zinc-900 dark:text-zinc-100 dark:[color-scheme:dark]"
    >
      {options.map(o => (
        <option key={o.value} value={o.value} className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
          {o.label}
        </option>
      ))}
    </select>
  )
}
