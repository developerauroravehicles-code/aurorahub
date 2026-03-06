'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

const WORKER_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'employee', label: 'Employee' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'installer_technician', label: 'Installer Technician' },
  { value: 'dealer_staff', label: 'Dealer Staff' },
  { value: 'regional_manager', label: 'Regional Manager' },
  { value: 'support_staff', label: 'Support Staff' },
]

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'pending_verification', label: 'Pending Verification' },
  { value: 'suspended', label: 'Suspended' },
]

export function PersonnelFilters({
  dealers,
  currentType,
  currentStatus,
  currentDealer,
}: {
  dealers: { id: string; name: string }[]
  currentType?: string
  currentStatus?: string
  currentDealer?: string
}) {
  const router = useRouter()

  const handleChange = (key: string, value: string) => {
    const params = new URLSearchParams()
    if (key !== 'worker_type' && currentType) params.set('worker_type', currentType)
    if (key !== 'status' && currentStatus) params.set('status', currentStatus)
    if (key !== 'dealer' && currentDealer) params.set('dealer', currentDealer)
    if (key === 'worker_type' && value) params.set('worker_type', value)
    if (key === 'status' && value) params.set('status', value)
    if (key === 'dealer' && value) params.set('dealer', value)
    router.push(`/dashboard/hr/personnel?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-400">Type</label>
        <select
          value={currentType ?? ''}
          onChange={(e) => handleChange('worker_type', e.target.value)}
          className="rounded-md bg-gray-900 border border-gray-700 text-white px-3 py-2 text-sm min-w-[200px] focus:ring-1 focus:ring-[#C27E00] focus:outline-none"
          style={{ colorScheme: 'light' }}
        >
          {WORKER_TYPES.map((r) => (
            <option key={r.value || 'all'} value={r.value} className="bg-gray-900 text-white">
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-400">Status</label>
        <select
          value={currentStatus ?? ''}
          onChange={(e) => handleChange('status', e.target.value)}
          className="rounded-md bg-gray-900 border border-gray-700 text-white px-3 py-2 text-sm min-w-[180px] focus:ring-1 focus:ring-[#C27E00]"
          style={{ colorScheme: 'light' }}
        >
          {STATUSES.map((s) => (
            <option key={s.value || 'all'} value={s.value} className="bg-gray-900 text-white">{s.label}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-400">Dealer</label>
        <select
          value={currentDealer ?? ''}
          onChange={(e) => handleChange('dealer', e.target.value)}
          className="rounded-md bg-gray-900 border border-gray-700 text-white px-3 py-2 text-sm min-w-[160px] focus:ring-1 focus:ring-[#C27E00]"
          style={{ colorScheme: 'light' }}
        >
          <option value="" className="bg-gray-900 text-white">All</option>
          <option value="platform" className="bg-gray-900 text-white">Platform</option>
          {dealers.map((d) => (
            <option key={d.id} value={d.id} className="bg-gray-900 text-white">{d.name}</option>
          ))}
        </select>
      </div>
      {(currentType || currentStatus || currentDealer) && (
        <Link href="/dashboard/hr/personnel" className="text-sm text-[#C27E00] hover:text-[#a06900]">Clear</Link>
      )}
    </div>
  )
}
