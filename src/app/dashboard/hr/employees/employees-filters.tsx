'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formSelectClassName } from '@/lib/form-field-styles'

// Platform roles only (dealer_id = null)
const ROLES = [
  { value: '', label: 'All Roles' },
  { value: 'specialist', label: 'Technical Support' },
  { value: 'aurora_manager', label: 'Aurora Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'it', label: 'IT' },
]

export function EmployeesFilters({
  currentRole,
}: {
  currentRole?: string
}) {
  const router = useRouter()

  const handleFilterChange = (role: string) => {
    const params = new URLSearchParams()
    if (role) params.set('role', role)
    router.push(`/dashboard/hr/employees?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <label className="text-sm text-zinc-500 dark:text-gray-400">Role</label>
        <select
          value={currentRole ?? ''}
          onChange={(e) => handleFilterChange(e.target.value)}
          className={formSelectClassName}
        >
          {ROLES.map((r) => (
            <option key={r.value || 'all'} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      {currentRole && (
        <Link
          href="/dashboard/hr/employees"
          className="text-sm text-[#C27E00] hover:text-[#a06900]"
        >
          Clear filters
        </Link>
      )}
    </div>
  )
}
