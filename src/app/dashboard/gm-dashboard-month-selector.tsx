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
  const currentLabel = options.find(o => o.value === currentMonth)?.label ?? currentMonth

  return (
    <select
      value={currentMonth}
      onChange={handleChange}
      className="bg-transparent text-gray-400 border-0 p-0 text-xs cursor-pointer hover:text-gray-300 focus:outline-none focus:ring-0"
    >
      {options.map(o => (
        <option key={o.value} value={o.value} className="bg-black text-white">
          {o.label}
        </option>
      ))}
    </select>
  )
}
