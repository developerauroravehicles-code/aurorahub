'use client'

import { useState } from 'react'
import { createPersonnel } from './actions'
import { useRouter } from 'next/navigation'

const WORKER_TYPES = [
  { value: 'employee', label: 'Employee' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'installer_technician', label: 'Installer Technician' },
  { value: 'dealer_staff', label: 'Dealer Staff' },
  { value: 'regional_manager', label: 'Regional Manager' },
  { value: 'support_staff', label: 'Support Staff' },
]

const STATUSES = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'pending_verification', label: 'Pending Verification' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
]

const CONTRACT_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'per_installation', label: 'Per Installation' },
  { value: 'commission', label: 'Commission' },
  { value: 'freelance', label: 'Freelance' },
]

const PLATFORM_ROLES = [
  { value: '', label: '—' },
  { value: 'specialist', label: 'Technical Support' },
  { value: 'aurora_manager', label: 'Aurora Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'it', label: 'IT' },
]

const SALARY_TYPES = [
  { value: '', label: '—' },
  { value: 'salary', label: 'Salary (annual)' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'per_installation', label: 'Per Installation' },
  { value: 'commission', label: 'Commission' },
]

const WORK_ARRANGEMENTS = [
  { value: '', label: '—' },
  { value: 'remote', label: 'Remote' },
  { value: 'on_site', label: 'On-site' },
  { value: 'field', label: 'Field' },
]

const PROVINCES = [
  { value: 'ontario', label: 'Ontario' },
  { value: 'british_columbia', label: 'British Columbia' },
  { value: 'alberta', label: 'Alberta' },
  { value: 'quebec', label: 'Quebec' },
  { value: 'manitoba', label: 'Manitoba' },
  { value: 'saskatchewan', label: 'Saskatchewan' },
  { value: 'out_of_canada', label: 'Out Of Canada' },
]

export function PersonnelForm({
  regions,
  dealers,
  managers,
  initialData,
}: {
  regions: { id: string; name: string }[]
  dealers: { id: string; name: string }[]
  managers: { id: string; full_name: string | null }[]
  initialData?: Record<string, unknown>
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = e.currentTarget
    const data: Record<string, string> = {}
    const inputs = form.querySelectorAll('input, select, textarea')
    inputs.forEach((el) => {
      const name = (el as HTMLInputElement).name
      if (name) data[name] = (el as HTMLInputElement).value
    })
    const result = await createPersonnel(data)
    setLoading(false)
    if (result.error) setError(result.error)
    else router.push('/dashboard/hr/personnel')
  }

  const inputClass = 'w-full rounded-md bg-white/5 border border-gray-700 text-white px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00]'
  const selectClass = 'w-full rounded-md bg-gray-900 border border-gray-700 text-white px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:outline-none [&>option]:bg-gray-900 [&>option]:text-white'
  const labelClass = 'block text-sm text-gray-400 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>Full Name *</label>
            <input name="full_name" required className={inputClass} defaultValue={initialData?.full_name as string} />
          </div>
          <div>
            <label className={labelClass}>Worker ID (auto-generated if empty)</label>
            <input name="worker_id" className={inputClass} placeholder="e.g. WRK-001" />
          </div>
          <div>
            <label className={labelClass}>Worker Type</label>
            <select name="worker_type" className={selectClass} defaultValue="employee" style={{ colorScheme: 'light' }}>
              {WORKER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select name="status" className={selectClass} defaultValue="onboarding" style={{ colorScheme: 'light' }}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input name="phone" type="tel" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input name="email" type="email" className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Address</label>
            <textarea name="address" rows={2} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Emergency Contact Name</label>
            <input name="emergency_contact_name" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Emergency Contact Phone</label>
            <input name="emergency_contact_phone" type="tel" className={inputClass} />
          </div>
        </div>
      </div>

      {/* Identity & Verification (Canada) */}
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Identity & Verification (Canada)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Government ID</label>
            <input name="government_id" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>SIN Verified</label>
            <select name="sin_verified" className={selectClass} style={{ colorScheme: 'light' }}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Work Permit / Visa Status</label>
            <select name="work_permit_status" className={selectClass} style={{ colorScheme: 'light' }}>
              <option value="">—</option>
              <option value="N/A">N/A</option>
              <option value="OK">OK</option>
              <option value="Pending">Pending</option>
              <option value="Not Required">Not Required</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Driver License</label>
            <select name="driver_license" className={selectClass} style={{ colorScheme: 'light' }}>
              <option value="">—</option>
              <option value="N/A">N/A</option>
              <option value="OK">OK</option>
              <option value="Valid">Valid</option>
              <option value="Pending">Pending</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Background Check Status</label>
            <select name="background_check_status" className={selectClass} style={{ colorScheme: 'light' }}>
              <option value="">—</option>
              <option value="N/A">N/A</option>
              <option value="OK">OK</option>
              <option value="Pending">Pending</option>
              <option value="Not Required">Not Required</option>
            </select>
          </div>
        </div>
      </div>

      {/* Professional Info */}
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Professional Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Position</label>
            <input name="position" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select name="platform_role" className={selectClass} style={{ colorScheme: 'light' }}>
              {PLATFORM_ROLES.map((r) => <option key={r.value || 'empty'} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Region</label>
            <select name="region_id" className={selectClass} style={{ colorScheme: 'light' }}>
              <option value="">—</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Assigned Manager</label>
            <select name="assigned_manager_id" className={selectClass} style={{ colorScheme: 'light' }}>
              <option value="">—</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name ?? 'Unnamed'}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Start Date</label>
            <input name="start_date" type="date" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Contract Type</label>
            <select name="contract_type" className={selectClass} style={{ colorScheme: 'light' }}>
              <option value="">—</option>
              {CONTRACT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Work Arrangement</label>
            <select name="work_arrangement" className={selectClass} style={{ colorScheme: 'light' }}>
              {WORK_ARRANGEMENTS.map((w) => <option key={w.value || 'empty'} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Province</label>
            <select name="province" className={selectClass} style={{ colorScheme: 'light' }}>
              <option value="">—</option>
              {PROVINCES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Dealer (for dealer staff / installers)</label>
            <select name="dealer_id" className={selectClass} style={{ colorScheme: 'light' }}>
              <option value="">Platform</option>
              {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Salary / Compensation */}
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Salary & Compensation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Amount</label>
            <input name="salary_amount" type="number" step="0.01" min="0" className={inputClass} placeholder="e.g. 65000" />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select name="salary_type" className={selectClass} style={{ colorScheme: 'light' }}>
              {SALARY_TYPES.map((s) => <option key={s.value || 'empty'} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Currency</label>
            <select name="salary_currency" className={selectClass} style={{ colorScheme: 'light' }}>
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
      </div>

      {error && <p className="text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="px-6 py-2 rounded-md bg-[#C27E00] text-white font-medium hover:bg-[#a06900] disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Create Personnel'}
      </button>
    </form>
  )
}
